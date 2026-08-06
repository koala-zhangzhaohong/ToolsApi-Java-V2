declare module 'flv.js' {
  interface MediaDataSource {
    type: 'flv'
    isLive?: boolean
    url: string
  }

  interface Player {
    attachMediaElement(element: HTMLMediaElement): void
    detachMediaElement(): void
    load(): void
    unload(): void
    play(): Promise<void>
    pause(): void
    destroy(): void
    on(event: string, listener: (...args: unknown[]) => void): void
  }

  const flvjs: {
    Events: {
      ERROR: string
    }
    isSupported(): boolean
    createPlayer(source: MediaDataSource, config?: { enableStashBuffer?: boolean }): Player
  }
  export default flvjs
}
