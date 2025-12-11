import React, { lazy, Suspense, Component } from 'react'
import { observer } from 'mobx-react'
import { getWebSocketProtocol, getClusterUrl } from 'utils'

const ContainerTerminal = lazy(() =>
  import(/* webpackChunkName: "terminal" */ './terminal')
)

const BG_COLOR = '#181d28'

@observer
export default class SessionTerminal extends Component {
  constructor(props) {
    super(props)

    this.terminalRef = null
  }

  get url() {
    return `${getWebSocketProtocol(window.location.protocol)}://${
      window.location.host
    }${getClusterUrl(`/${this.props.url}`)}`
  }

  resizeTerminal = () => {
    this.terminalRef && this.terminalRef.onResize()
  }

  render() {
    const { isEdgeNode, uploadUrl, downloadUrl } = this.props

    if (!this.props.url) {
      return null
    }

    const terminalOpts = {
      theme: {
        background: BG_COLOR,
      },
    }

    return (
      <div
        style={{
          height: '100%',
          borderRadius: '4px',
          background: BG_COLOR,
          padding: '12px',
          color: '#fff',
        }}
      >
        <Suspense fallback={'Loading'}>
          {this.props.isLoading ? (
            'Loading'
          ) : (
            <ContainerTerminal
              websocketUrl={this.url}
              key={this.url}
              terminalOpts={terminalOpts}
              isEdgeNode={isEdgeNode}
              uploadUrl={uploadUrl}
              downloadUrl={downloadUrl}
              ref={ref => {
                this.terminalRef = ref
              }}
            />
          )}
        </Suspense>
      </div>
    )
  }
}
