import * as React from 'react'
import { Alert, Notify, Icon } from '@kube-design/components'
import {
  InputWrapper,
  ModalBody,
  ModalTitle,
  ModalWrapper,
  UploadFile,
  UploadWrapper,
} from './index.styles'

class Upload extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      value: props.value || [],
    }
    this.fileInputRef = null
    this.setFileInputRef = element => {
      this.fileInputRef = element
    }
  }

  handleAdd = file => {
    this.setState(
      prevState => ({
        value: [...prevState.value, file],
      }),
      () => {
        if (this.props.onChange) {
          this.props.onChange(this.state.value)
        }
      }
    )
  }

  handleRemove = index => {
    this.setState(
      prevState => {
        const newValue = [...prevState.value]
        newValue.splice(index, 1)
        return { value: newValue }
      },
      () => {
        if (this.props.onChange) {
          this.props.onChange(this.state.value)
        }
      }
    )
  }

  handleUploadClick = () => {
    if (this.fileInputRef) {
      this.fileInputRef.click()
    }
  }

  handleFileChange = e => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const file = files[0]

    if (file.size > 1024 * 1024 * 1024) {
      Notify.error(t('FILE_SIZE_CANNOT_EXCEED_1G'))
      return
    }
    this.handleAdd(file)
  }

  render() {
    const { value } = this.state

    return (
      <>
        <input
          ref={this.setFileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={this.handleFileChange}
        />
        <UploadWrapper onClick={this.handleUploadClick}>
          <div>
            <Icon name="upload-duotone" size={40} />
          </div>
          <div>{t('PLEASE_SELECT_FILE')}</div>
          <div>{t('ONLY_SUPPORT_UPLOAD_FILE')}</div>
        </UploadWrapper>
        {value.map((file, index) => (
          <UploadFile key={index}>
            <span>{file.name}</span>
            <Icon
              size={16}
              name="close"
              className="icon-clickable"
              onClick={() => {
                this.handleRemove(index)
              }}
            />
          </UploadFile>
        ))}
      </>
    )
  }
}

class UploadModal extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      files: [],
      path: '',
    }
  }

  handleFilesChange = files => {
    this.setState({ files })
  }

  handlePathChange = e => {
    this.setState({ path: e.target.value })
  }

  handleOk = () => {
    const { files, path } = this.state

    // 手动验证
    if (!files || files.length === 0) {
      Notify.error(t('PLEASE_SELECT_FILE'))
      return
    }

    if (!path) {
      Notify.error(t('PLEASE_ENTER_FILE_DIRECTORY'))
      return
    }
    this.handleSubmit()
  }

  handleSubmit = () => {
    const { files, path } = this.state
    const { uploadUrl } = this.props

    // 手动提交，使用原生 fetch 处理文件上传
    const url = uploadUrl.includes('?')
      ? `${uploadUrl}&path=${encodeURIComponent(path)}`
      : `${uploadUrl}?path=${encodeURIComponent(path)}`

    const formDataObj = new FormData()
    files.forEach(file => {
      formDataObj.append(file.name, file)
    })

    // 使用原生 fetch 处理文件上传，避免 request.js 的 JSON 转换
    fetch(url, {
      method: 'POST',
      body: formDataObj,
      credentials: 'include',
    })
      .then(response => {
        if (!response) {
          throw new Error(t('UPLOAD_FAILED'))
        }
        if (response.ok) {
          Notify.success(t('UPLOAD_SUCCESSFUL'))
          if (this.props.onCancel) {
            this.props.onCancel({})
          }
          return
        }
        response.text().then(text => {
          window._resText = text
          Notify.error(`${t('UPLOAD_FAILED')}: ${response.statusText} ${text}`)
        })
      })
      .catch(err => {
        Notify.error(`${t('UPLOAD_FAILED')}: ${err}`)
      })
  }

  render() {
    const { title, visible, uploadUrl, ...rest } = this.props
    const { files, path } = this.state

    return (
      <ModalWrapper
        visible={visible}
        hideHeader={true}
        onOk={this.handleOk}
        onCancel={this.props.onCancel}
        {...rest}
      >
        <ModalBody>
          <ModalTitle>{t('UPLOAD')}</ModalTitle>
          <Alert
            className="mb-12"
            icon="information"
            type="default"
            message={t('UP_NEED_TAR')}
          />
          <div>
            <div style={{ marginBottom: '12px' }}>
              <Upload value={files} onChange={this.handleFilesChange} />
            </div>
            <div>
              <div style={{ marginBottom: '4px' }}>{t('FILE_DIRECTORY')}</div>
              <InputWrapper
                value={path}
                onChange={this.handlePathChange}
                placeholder={t('PLEASE_ENTER_FILE_DIRECTORY')}
              />
            </div>
          </div>
        </ModalBody>
      </ModalWrapper>
    )
  }
}

export default UploadModal
