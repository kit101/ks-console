/*
 * Please refer to the LICENSE file in the root directory of the project.
 * https://github.com/kubesphere/console/blob/master/LICENSE
 */

import * as React from 'react'
import { Alert, Form, Notify } from '@kube-design/components'
import {
  ModalBody,
  ModalTitle,
  InputWrapper,
  ModalWrapper,
} from './index.styles'

class DownloadModal extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      path: '',
      // path: '/opt/kubesphere/console/package.json',
      showUrl: '',
    }
  }

  handleOk = () => {
    const { path } = this.state

    // 手动验证
    if (!path) {
      Notify.error(t('PLEASE_ENTER_FILE_DIRECTORY'))
      return
    }

    this.handleSubmit({ path })
  }

  handleSubmit = values => {
    const { ...rest } = this.props
    const originalDownloadUrl = this.props.downloadUrl
    const downloadUrl =
      !originalDownloadUrl.startsWith('http') &&
      !originalDownloadUrl.startsWith('/')
        ? `/${originalDownloadUrl}`
        : originalDownloadUrl

    const url = downloadUrl.includes('?')
      ? `${downloadUrl}&path=${values.path}`
      : `${downloadUrl}?path=${values.path}`
    const a = document.createElement('a')
    a.href = url
    this.setState({ showUrl: url })
    const fileName = url.split('/').pop()
    a.rel = 'noopener noreferrer'
    a.style.display = 'none'
    a.download = fileName || 'file'
    document.body.appendChild(a)
    Notify.info(t('PLEASE_SELECT_FILE_SAVE_PATH_AND_NAME'))
    a.click()
    document.body.removeChild(a)
    rest.onCancel && rest.onCancel({})
  }

  handleInputChange = value => {
    this.setState({ path: value })
  }

  render() {
    const { title, visible, ...rest } = this.props
    const { path } = this.state

    return (
      <ModalWrapper
        visible={visible}
        hideHeader
        onOk={this.handleOk}
        onCancel={this.props.onCancel}
        {...rest}
      >
        <ModalBody>
          <ModalTitle>{title || t('DOWNLOAD')}</ModalTitle>
          <Alert
            type="default"
            icon="information"
            message={t('DOWN_NEED_TAR')}
          />
          <Form>
            <Form.Item
              name="path"
              label={t('FILE_DIRECTORY')}
              rules={[
                {
                  required: true,
                  message: t('PLEASE_ENTER_FILE_DIRECTORY'),
                },
              ]}
            >
              <InputWrapper
                value={path}
                placeholder={t('PLEASE_ENTER_FILE_DIRECTORY')}
                onChange={this.handleInputChange}
                // style={{ maxWidth: 'none' }}
              />
            </Form.Item>
            {/* <div>{this.state.showUrl}</div> */}
          </Form>
        </ModalBody>
      </ModalWrapper>
    )
  }
}

export default DownloadModal
