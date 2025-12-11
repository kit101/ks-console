import React, { Suspense } from 'react'
import { debounce } from 'lodash'
import { Terminal } from 'xterm'
import PropTypes from 'prop-types'
import * as fit from 'xterm/lib/addons/fit/fit'
import SocketClient from 'utils/socket.client'

// 添加样式导入
import styled from 'styled-components'

import { Icon, Tooltip } from '@kube-design/components'
import { Modal } from 'components/Base'
import {
  Wrapper,
  TerminalWrapper as TerminalWrapper1,
  ActionsWrapper,
  Divider,
} from './TerminalWrapper.styles'

// 动态导入模态框组件
import UploadModal from './UploadModal/index'
import DownloadModal from './DownloadModal/index'

import './terminal.css'
import './xterm.css'

Terminal.applyAddon(fit)

export const FALLBACK = 'Loading'

const DEFAULT_TERMINAL_OPTS = {
  lineHeight: 1.2,
  cursorBlink: true,
  cursorStyle: 'underline',
  fontSize: 12,
  fontFamily: "Monaco, Menlo, Consolas, 'Courier New', monospace",
  theme: {
    background: '#181d28',
  },
}

export default class ContainerTerminal extends React.Component {
  static propsTypes = {
    terminalOpts: PropTypes.object,
    websocketUrl: PropTypes.string,
    initText: PropTypes.string,
    isEdgeNode: PropTypes.bool,
    // 添加新的属性类型定义
    uploadUrl: PropTypes.string,
    downloadUrl: PropTypes.string,
  }

  static defaultProps = {
    terminalOpts: {},
    initText: 'Connecting',
    isEdgeNode: false,
    // 添加默认值
    uploadUrl: '',
    downloadUrl: '',
  }

  get isWsOpen() {
    return this.ws && this.ws.getSocketState() === 'open'
  }

  constructor(props) {
    super(props)

    this.first = true
    this.containerRef = React.createRef()
    this.initTimer = null

    // 添加状态管理
    this.state = {
      uploadVisible: false,
      downloadVisible: false,
      path: '', // 用于存储文件路径
    }
    console.log(
      'Container Terminal. props: ',
      this.props,
      'state: ',
      this.state
    )
  }

  componentDidMount() {
    this.term = this.initTerm()
    this.ws = this.createWS()

    this.onTerminalResize()
    this.onTerminalKeyPress()

    this.disableTermStdin()
  }

  componentWillUnmount() {
    this.term.destroy()
    this.disconnect()
    this.removeResizeListener()
    this.initTimer && clearInterval(this.initTimer)
  }

  // 添加方法用于处理上传和下载
  handleUpload = () => {
    this.setState({ uploadVisible: true, path: '' })
  }

  handleDownload = () => {
    this.setState({ downloadVisible: true, path: '' })
  }

  closeUploadModal = () => {
    this.setState({ uploadVisible: false })
  }

  closeDownloadModal = () => {
    this.setState({ downloadVisible: false })
  }

  handlePathChange = e => {
    this.setState({ path: e.target.value })
  }

  handleUploadSubmit = () => {
    const { uploadUrl } = this.props
    const { path } = this.state

    if (!path) {
      // 这里应该显示错误提示，但为了简化实现，我们直接返回
      return
    }

    // 构造上传URL
    const url = uploadUrl.includes('?')
      ? `${uploadUrl}&path=${encodeURIComponent(path)}`
      : `${uploadUrl}?path=${encodeURIComponent(path)}`

    // 创建一个隐藏的文件输入元素
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.style.display = 'none'

    fileInput.onchange = e => {
      const files = e.target.files
      if (files && files.length > 0) {
        const file = files[0]

        // 检查文件大小
        if (file.size > 1024 * 1024 * 1024) {
          // 1GB
          alert(t('FILE_SIZE_CANNOT_EXCEED_1G'))
          return
        }

        const formData = new FormData()
        formData.append(file.name, file)

        // 发送上传请求
        fetch(url, {
          method: 'POST',
          body: formData,
        })
          .then(response => {
            if (response.ok) {
              alert(t('UPLOAD_SUCCESSFUL'))
              this.closeUploadModal()
            } else {
              alert(t('UPLOAD_FAILED'))
            }
          })
          .catch(() => {
            alert(t('UPLOAD_FAILED'))
          })
      }
    }

    document.body.appendChild(fileInput)
    fileInput.click()
    document.body.removeChild(fileInput)
  }

  handleDownloadSubmit = () => {
    const { downloadUrl } = this.props
    const { path } = this.state

    if (!path) {
      // 这里应该显示错误提示，但为了简化实现，我们直接返回
      return
    }

    // 构造下载URL
    const url = downloadUrl.includes('?')
      ? `${downloadUrl}&path=${encodeURIComponent(path)}`
      : `${downloadUrl}?path=${encodeURIComponent(path)}`

    // 创建一个隐藏的链接元素并触发点击事件来下载文件
    const link = document.createElement('a')
    link.href = url
    link.download = path.split('/').pop() || 'download'
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    this.closeDownloadModal()
  }

  initTerm() {
    const { initText } = this.props
    const terminalOpts = this.getTerminalOpts()
    const term = new Terminal(terminalOpts)
    term.open(this.containerRef.current)
    this.initTimer = this.renderConnecting(term, initText)
    term.fit()

    return term
  }

  renderConnecting(term, initText) {
    let count = 0
    const timer = setInterval(() => {
      term.reset()
      term.write(`${initText}${'.'.repeat(++count)}`)
      if (count > 2) {
        count = 0
      }
    }, 500)
    return timer
  }

  disableTermStdin(disabled = true) {
    const { textarea = {} } = this.term
    textarea.disabled = disabled
  }

  getTerminalOpts() {
    const { terminalOpts } = this.props
    return { ...DEFAULT_TERMINAL_OPTS, ...terminalOpts }
  }

  onTerminalResize() {
    window.addEventListener('resize', this.onResize)
    this.term.on('resize', this.resizeRemoteTerminal)
  }

  onTerminalKeyPress() {
    this.term.on('data', this.sendTerminalInput)
  }

  sendTerminalInput = data => {
    if (this.isWsOpen) {
      this.ws.send(this.packStdin(data))
    }
  }

  resizeRemoteTerminal = () => {
    const { cols, rows } = this.term
    if (this.isWsOpen) {
      this.ws.send(this.packResize(cols, rows))
    }
  }

  removeResizeListener() {
    window.removeEventListener('resize', this.onResize)
  }

  fitTerm = () => this.term.fit()

  onResize = debounce(this.fitTerm, 800)

  packStdin = data =>
    JSON.stringify({
      Op: 'stdin',
      Data: data,
    })

  packResize = (col, row) =>
    JSON.stringify({
      Op: 'resize',
      Cols: col,
      Rows: row,
    })

  unpackStdout = data => data.Data

  createWS() {
    return new SocketClient(this.props.websocketUrl, {
      onmessage: this.onWSReceive,
      onerror: this.onWSError,
    })
  }

  onWSError = ex => {
    this.initTimer && clearInterval(this.initTimer)
    this.fatal(ex.message)
  }

  onWSReceive = data => {
    this.initTimer && clearInterval(this.initTimer)
    const term = this.term

    if (this.first) {
      this.first = false
      this.disableTermStdin(false)
      term.reset()
      term.element && term.focus()
      this.resizeRemoteTerminal()
    }

    const stdout = this.unpackStdout(data)
    term.write(stdout)
  }

  disconnect = () => {
    if (this.term) {
      this.disableTermStdin(true)
    }

    if (this.ws) {
      this.ws.close(true)
    }
  }

  fatal = message => {
    const { isEdgeNode } = this.props
    const first = this.first
    if (!message && first)
      message = `Could not connect to the ${
        isEdgeNode ? 'node' : 'container'
      }. Do you have sufficient privileges?`
    if (!message) message = 'disconnected'
    if (!first) message = `\r\n${message}`
    if (first) this.term.reset()
    this.term.write(`\x1b[31m${message}\x1b[m\r\n`)
  }

  // 添加渲染操作按钮的方法
  renderActions() {
    const { uploadUrl, downloadUrl } = this.props

    if (!uploadUrl && !downloadUrl) {
      return null
    }
    const actions = []

    if (downloadUrl)
      actions.push(
        <Tooltip content={t('DOWNLOAD')}>
          <Icon
            name="download"
            size={20}
            type="light"
            className="icon-clickable"
            clickable
            onClick={() => {
              this.setState({ downloadVisible: true })
            }}
          />
        </Tooltip>
      )
    if (uploadUrl)
      actions.push(
        <Tooltip content={t('UPLOAD')}>
          <Icon
            name="upload"
            size={20}
            type="light"
            className="icon-clickable"
            clickable
            onClick={() => {
              this.setState({ uploadVisible: true })
            }}
          />
          {/* <span>{t('UPLOAD')}</span> */}
        </Tooltip>
      )
    return (
      <ActionsWrapper>
        {actions.map((action, index) => {
          return (
            <React.Fragment key={index}>
              {action}
              {index !== actions.length - 1 && <Divider>|</Divider>}
            </React.Fragment>
          )
        })}
      </ActionsWrapper>
    )
  }

  render() {
    const { uploadUrl, downloadUrl } = this.props
    const { uploadVisible, downloadVisible, path } = this.state
    return (
      <Wrapper>
        <Suspense fallback={FALLBACK}>
          <TerminalWrapper1>
            <kubernetes-container-terminal
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
              }}
              ref={this.containerRef}
            />
            {this.renderActions()}
          </TerminalWrapper1>

          {uploadUrl && uploadVisible && (
            <UploadModal
              visible={true}
              uploadUrl={uploadUrl}
              onCancel={() => this.setState({ uploadVisible: false })}
            />
          )}
          {downloadUrl && downloadVisible && (
            <DownloadModal
              visible={true}
              downloadUrl={downloadUrl}
              onCancel={() => {
                this.setState({ downloadVisible: false })
              }}
            />
          )}
        </Suspense>
      </Wrapper>
    )
  }
}
