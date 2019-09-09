/* globals console, Promise */
import Vue from 'vue'
import { Component, Prop, Watch } from 'vue-property-decorator'
import AllComponents from 'formiojs/components'
import Components from 'formiojs/components/Components'
import { Submission, Form } from '@goatlab/goatjs'
Components.setComponents(AllComponents)
import FormioForm from 'formiojs/Form'
import Formio from 'formiojs/Formio'
const pluralize = require('pluralize')

@Component
export default class extends Vue {
  formio?: Formio

  @Prop()
  src?: string

  @Prop()
  url?: string

  @Prop()
  form?: object

  @Prop()
  APP_URL?: string

  @Prop()
  LOOPBACK_URL?: string

  @Prop()
  submission?: object

  @Prop()
  language?: string

  @Prop({ default: () => {} })
  options?: object
  _uid?: any

  @Watch('src')
  srcChange(value: string) {
    if (this.formio) {
      this.formio.src = value
    }
  }

  @Watch('url')
  urlChange(value: string) {
    if (this.formio) {
      this.formio.url = value
    }
  }

  @Watch('form')
  formChange(value: object) {
    if (this.formio) {
      this.formio.form = value
    }
  }

  @Watch('submission')
  submissionhange(value: object) {
    if (this.formio) {
      this.formio.submission = value
    }
  }

  @Watch('language')
  languageChange(value: string) {
    if (this.formio) {
      this.formio.language = value
    }
  }

  async mounted() {
    let localForms = await Form.local().get()
    localForms = localForms.reduce((r, form) => {
      r[form.data._id] = form.data.path
      return r
    }, {})
    const loopbackGetPlugin = {
      priority: 0,
      preRequest: async request => {
        if (
          !(request.method === 'GET') ||
          !request.url.includes(this.APP_URL)
        ) {
          return undefined
        }
      },
      request: () => {
        console.log('request')
      },
      preStaticRequest: () => {
        console.log('preStaticRequest')
      },
      staticRequest: async request => {
        if (
          !(request.method === 'GET') ||
          !request.url.includes(this.APP_URL)
        ) {
          return undefined
        }

        const { url } = request
        const formPath =
          localForms[
            url.substring(
              url.lastIndexOf('/form/') + 6,
              url.lastIndexOf('/submission')
            )
          ]
        const filter = url.includes('&filter')
          ? decodeURIComponent(
              url.substring(url.lastIndexOf('&filter=') + 8, url.length)
            )
          : '{}'

        let searchString = undefined
        let where = undefined

        if (url.includes('&where')) {
          const lastIndex =
            filter === '{}' ? url.length : url.lastIndexOf('&filter=')
          searchString = decodeURIComponent(
            url.substring(url.lastIndexOf('__regex') + 8, lastIndex)
          )

          where = decodeURIComponent(
            url.substring(
              url.lastIndexOf('&where') + 6,
              url.lastIndexOf('__regex')
            )
          ).replace('=', '')
        } else if (url.includes('__regex')) {
          const startIndex = url.lastIndexOf('&')
          const lastIndex = url.lastIndexOf('=')

          searchString = decodeURIComponent(
            url.substring(lastIndex + 1, url.length)
          )

          const searchKey = decodeURIComponent(
            url.substring(startIndex + 1, url.indexOf('__regex'))
          )

          where = `{"${searchKey}": {"like": {{input}}, "options": "si" }}`
        }

        const lbQueryUrl: any = {
          base: this.LOOPBACK_URL,
          path: formPath,
          formField: pluralize.singular(formPath),
          limit: Number(
            url.substring(
              url.lastIndexOf('?limit=') + 7,
              url.lastIndexOf('&skip')
            )
          ),
          filter,
          where,
          searchString
        }

        // Make the field searchable
        if (lbQueryUrl.searchString && lbQueryUrl.where) {
          lbQueryUrl.where = lbQueryUrl.where.replace(
            /{{input}}/g,
            `"${lbQueryUrl.searchString}"`
          )
        }

        try {
          if (lbQueryUrl.filter) {
            lbQueryUrl.filter = lbQueryUrl.filter
              ? JSON.parse(lbQueryUrl.filter)
              : undefined
          }
        } catch (error) {
          console.error(
            'Could not parse FILTER one of your resource queries: ',
            formPath,
            url
          )
          return undefined
        }
        try {
          if (lbQueryUrl.where) {
            lbQueryUrl.where = lbQueryUrl.where
              ? JSON.parse(lbQueryUrl.where)
              : undefined
            lbQueryUrl.filter.where = lbQueryUrl.where
          } else {
            const currentValue = this.formio.submission.data[
              lbQueryUrl.formField
            ]
            if (currentValue) {
              lbQueryUrl.where = `{ _id: ${currentValue} }`
              lbQueryUrl.filter.where = lbQueryUrl.where
            }
          }
        } catch (error) {
          console.log(
            'Could not parse WHERE one of your resource queries: ',
            formPath,
            url
          )
          return undefined
        }

        const result = await Submission({ path: lbQueryUrl.path })
          .remote({ connectorName: 'loopback' })
          .raw(lbQueryUrl.filter)
          .populate(lbQueryUrl.filter.related)
          .get()

        return result
      }
    }
    Formio.setBaseUrl(this.APP_URL)
    Formio.registerPlugin(loopbackGetPlugin, `moveCallsToLoopback_${this._uid}`)

    this.initializeForm()
      .then(() => {
        this.setupForm()
      })
      .catch(err => {
        /* eslint-disable no-console */
        console.warn(err)
        /* eslint-enable no-console */
      })
  }

  destroyed() {
    if (this.formio) {
      Formio.deregisterPlugin(`moveCallsToLoopback_${this._uid}`)
      this.formio.destroy(true)
    }
  }

  initializeForm(): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.src) {
        resolve(
          new FormioForm(this.$refs.formio, this.src, this.options)
            .render()
            .then(
              (formio: Formio): Formio => {
                this.formio = formio
                return formio
              }
            )
            .catch((err: Error) => {
              /* eslint-disable no-console */
              console.error(err)
              /* eslint-enable no-console */
            })
        )
      } else if (this.form) {
        resolve(
          new FormioForm(this.$refs.formio, this.form, this.options)
            .render()
            .then(
              (formio: Formio): Formio => {
                this.formio = formio
                return formio
              }
            )
            .catch((err: Error) => {
              /* eslint-disable no-console */
              console.error(err)
              /* eslint-enable no-console */
            })
        )
      } else {
        // If we get to here there is no src or form
        reject('Must set src or form attribute')
      }
    })
  }

  setupForm() {
    if (!this.formio) {
      return
    }
    if (this.submission) {
      this.formio.submission = this.submission
    }

    if (this.url) {
      this.formio.url = this.url
    }

    this.formio.language = this.language ? this.language : 'en'

    this.formio.events.onAny((...args: any[]) => {
      const eventParts = args[0].split('.')

      // Only handle formio events.
      if (eventParts[0] !== 'formio' || eventParts.length !== 2) {
        return
      }

      // Remove formio. from event.
      args[0] = eventParts[1]

      this.$emit.apply(this, args)

      // Emit custom events under their own name as well.
      if (eventParts[1] === 'customEvent') {
        args[0] = args[1].type
        this.$emit.apply(this, args)
      }
    })
  }

  render(createElement: any) {
    return createElement('div', { ref: 'formio' })
  }
}
