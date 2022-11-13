const Model = require('objection').Model
const validate = require('validate.js')
const _ = require('lodash')

/* global WIKI */

/**
 * Comments model
 */
module.exports = class Comment extends Model {
  static get tableName() { return 'comments' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: [],

      properties: {
        id: {type: 'integer'},
        content: {type: 'string'},
        render: {type: 'string'},
        name: {type: 'string'},
        email: {type: 'string'},
        ip: {type: 'string'},
        createdAt: {type: 'string'},
        updatedAt: {type: 'string'}
      }
    }
  }

  static get relationMappings() {
    return {
      author: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./users'),
        join: {
          from: 'comments.authorId',
          to: 'users.id'
        }
      },
      page: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./pages'),
        join: {
          from: 'comments.pageId',
          to: 'pages.id'
        }
      }
    }
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString()
  }
  $beforeInsert() {
    this.createdAt = new Date().toISOString()
    this.updatedAt = new Date().toISOString()
  }
  async $afterInsert() {
    // -> Add to Search Index
    await WIKI.models.comments.indexComments(this.pageId)
    // -> Send new comment notification
    await WIKI.models.comments.sendNotify(this.pageId, this.content, this.email)
  }
  static async afterUpdate({ asFindQuery }) {
    // -> Add to Search Index
    const comment = await asFindQuery().select('id')
    const pageId = await WIKI.data.commentProvider.getPageIdFromCommentId(comment[0].id)
    await WIKI.models.comments.indexComments(pageId)
  }

  /**
   * Post New Comment
   */
  static async postNewComment ({ pageId, replyTo, content, guestName, guestEmail, user, ip }) {
    // -> Input validation
    if (user.id === 2) {
      const validation = validate({
        email: _.toLower(guestEmail),
        name: guestName
      }, {
        email: {
          email: true,
          length: {
            maximum: 255
          }
        },
        name: {
          presence: {
            allowEmpty: false
          },
          length: {
            minimum: 2,
            maximum: 255
          }
        }
      }, { format: 'flat' })

      if (validation && validation.length > 0) {
        throw new WIKI.Error.InputInvalid(validation[0])
      }
    }

    content = _.trim(content)
    if (content.length < 2) {
      throw new WIKI.Error.CommentContentMissing()
    }

    // -> Load Page
    const page = await WIKI.models.pages.getPageFromDb(pageId)
    if (page) {
      if (!WIKI.auth.checkAccess(user, ['write:comments'], {
        path: page.path,
        locale: page.localeCode,
        tags: page.tags
      })) {
        throw new WIKI.Error.CommentPostForbidden()
      }
    } else {
      throw new WIKI.Error.PageNotFound()
    }

    // -> Process by comment provider
    return WIKI.data.commentProvider.create({
      page,
      replyTo,
      content,
      user: {
        ...user,
        ...(user.id === 2) ? {
          name: guestName,
          email: guestEmail
        } : {},
        ip
      }
    })
  }

  /**
   * Update an Existing Comment
   */
  static async updateComment ({ id, content, user, ip }) {
    // -> Load Page
    const pageId = await WIKI.data.commentProvider.getPageIdFromCommentId(id)
    if (!pageId) {
      throw new WIKI.Error.CommentNotFound()
    }
    const page = await WIKI.models.pages.getPageFromDb(pageId)
    if (page) {
      if (!WIKI.auth.checkAccess(user, ['manage:comments'], {
        path: page.path,
        locale: page.localeCode,
        tags: page.tags
      })) {
        throw new WIKI.Error.CommentManageForbidden()
      }
    } else {
      throw new WIKI.Error.PageNotFound()
    }

    // -> Process by comment provider
    return WIKI.data.commentProvider.update({
      id,
      content,
      page,
      user: {
        ...user,
        ip
      }
    })
  }

  /**
   * Delete an Existing Comment
   */
  static async deleteComment ({ id, user, ip }) {
    // -> Load Page
    const pageId = await WIKI.data.commentProvider.getPageIdFromCommentId(id)
    if (!pageId) {
      throw new WIKI.Error.CommentNotFound()
    }
    const page = await WIKI.models.pages.getPageFromDb(pageId)
    if (page) {
      if (!WIKI.auth.checkAccess(user, ['manage:comments'], {
        path: page.path,
        locale: page.localeCode,
        tags: page.tags
      })) {
        throw new WIKI.Error.CommentManageForbidden()
      }
    } else {
      throw new WIKI.Error.PageNotFound()
    }

    // -> Process by comment provider
    await WIKI.data.commentProvider.remove({
      id,
      page,
      user: {
        ...user,
        ip
      }
    })
  }

  /**
 * Add page comments to Page.extra.comment and
 * tell elasticsearch to index it
 *
 * @param {uint} pageId Page Id
 * @return {Promise} Updated Page
 *
 */

  static async indexComments(pageId) {
    // get comments for indexing purposes
    const existingComments = await WIKI.models.comments.query()
      .where('pageId', pageId)
      .orderBy('createdAt', 'desc')
    if (existingComments) {
      var cArray = []
      const page = await WIKI.models.pages.query().findById(pageId)
      existingComments.forEach(ec => {
        cArray.push(ec.content)
      })

      // -> Set Page.extra.comment field with array containing any comments found
      await WIKI.models.pages.query().patch({
        extra: JSON.stringify({
          ...page.extra,
          comment: cArray
        })
      }).where('id', page.id)

      // -> get updated Page obj; indexer wants `safeContent`
      const updPage = await WIKI.models.pages.query().findById(page.id)
      const pgContent = await WIKI.models.pages.query().findById(page.id).select('render')
      updPage.safeContent = WIKI.models.pages.cleanHTML(pgContent.render)

      // -> Update search index for this page
      return WIKI.data.searchEngine.updated(updPage)
    } else {
      WIKI.logger.info('No comments to index on this page.')
    }
  }
  /**
   * Send email notification for new comment
   *
   * @param {uint} pageId Page Id
   * @param {string} content Comment Content
   * @param {string} author Author Email
   *
   */
  static async sendNotify(pageId, content, author) {
    const page = await WIKI.models.pages.query().findById(pageId)
    let pageLink = `${WIKI.config.host}/${page.localeCode}/${page.path}`
    let pageRef = `'${page.title}'`
    let subjRef = `[wiki.js] New comment on ${page.title}`
    let textMeBb = `A new comment was added to '${pageRef}'. More information: ${pageLink}`
    let emails = [
      process.env.NOTIFY_EMAIL
    ]
    var emailOpts = {
      template: 'new-page',
      to: emails,
      subject: subjRef,
      data: {
        preheadertext: `New comment on '${pageRef}'`,
        title: `${author} commented on '${pageRef}'.`,
        content: content,
        buttonLink: pageLink,
        buttonText: `Open '${pageRef}'`
      },
      text: textMeBb
    }
    WIKI.mail.send(emailOpts)
  }
}
