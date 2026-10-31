import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import dominikaPhoto from './assets/dominika.jpg'
import birthdayPoster from './assets/dominika-birthday-poster.png'
import './App.css'

type Scene = 'surprise' | 'message' | 'birthday'
type CardSide = 'photo' | 'letter'
type MusicMode = 'file' | 'spotify'
type SpotifyContent = {
  kind: 'track' | 'episode'
  id: string
  url: string
  embedUrl: string
}

type SpotifyEmbedController = {
  addListener: (event: string, listener: () => void) => void
  destroy: () => void
  loadEntity: (url: string, preferVideo?: boolean, startAt?: number) => void
}

type SpotifyIframeAPI = {
  createController: (
    element: HTMLElement,
    options: { uri: string; width: string; height: string },
    callback: (controller: SpotifyEmbedController) => void,
  ) => void
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIframeAPI) => void
    birthdaySpotifyIframeAPI?: SpotifyIframeAPI
    birthdaySpotifyIframePromise?: Promise<SpotifyIframeAPI>
  }
}

const stars = Array.from({ length: 18 }, (_, index) => ({
  left: `${(index * 47 + 7) % 100}%`,
  top: `${(index * 67 + 13) % 100}%`,
  size: `${index % 9 === 0 ? 3 : index % 4 === 0 ? 2 : 1}px`,
  delay: `${(index * 173) % 5900}ms`,
  duration: `${3400 + ((index * 227) % 3100)}ms`,
  blue: index % 5 === 0,
}))

function useObjectUrl(file: File | null) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setObjectUrl(null)
      return
    }

    const nextObjectUrl = URL.createObjectURL(file)
    setObjectUrl(nextObjectUrl)
    return () => URL.revokeObjectURL(nextObjectUrl)
  }, [file])

  return objectUrl
}

function getSpotifyContent(value: string): SpotifyContent | null {
  try {
    const url = new URL(value)
    const match = url.pathname.match(/^\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/)?(track|episode)\/([A-Za-z0-9]+)\/?$/i)
    if (url.protocol !== 'https:' || url.hostname !== 'open.spotify.com' || !match) return null

    const kind = match[1].toLowerCase() as SpotifyContent['kind']
    const id = match[2]
    return {
      kind,
      id,
      url: `https://open.spotify.com/${kind}/${id}`,
      embedUrl: `https://open.spotify.com/embed/${kind}/${id}?utm_source=generator&theme=0`,
    }
  } catch {
    return null
  }
}

function formatEpisodeStart(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function loadSpotifyIframeAPI() {
  if (window.birthdaySpotifyIframeAPI) return Promise.resolve(window.birthdaySpotifyIframeAPI)
  if (window.birthdaySpotifyIframePromise) return window.birthdaySpotifyIframePromise

  const apiPromise = new Promise<SpotifyIframeAPI>((resolve, reject) => {
    window.onSpotifyIframeApiReady = (api) => {
      window.birthdaySpotifyIframeAPI = api
      resolve(api)
    }

    let script = document.querySelector<HTMLScriptElement>('script[data-birthday-spotify-iframe-api]')
    if (!script) {
      script = document.createElement('script')
      script.src = 'https://open.spotify.com/embed/iframe-api/v1'
      script.async = true
      script.dataset.birthdaySpotifyIframeApi = 'true'
      script.onerror = () => reject(new Error('Spotify iFrame API could not be loaded'))
      document.body.append(script)
    }
  })

  window.birthdaySpotifyIframePromise = apiPromise
  return apiPromise
}

function SpotifyEpisodeEmbed({ content, startAt }: { content: SpotifyContent; startAt: number }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let controller: SpotifyEmbedController | null = null
    let entityConfigured = false
    const element = mountRef.current

    loadSpotifyIframeAPI()
      .then((api) => {
        if (cancelled || !element) return
        api.createController(element, {
          uri: `spotify:episode:${content.id}`,
          width: '100%',
          height: '152',
        }, (nextController) => {
          if (cancelled) {
            nextController.destroy()
            return
          }
          controller = nextController
          nextController.addListener('ready', () => {
            if (cancelled) return
            if (!entityConfigured) {
              entityConfigured = true
              nextController.loadEntity(content.url, false, startAt)
            }
            setReady(true)
          })
        })
      })
      .catch(() => setFailed(true))

    return () => {
      cancelled = true
      controller?.destroy()
    }
  }, [content.id, content.url, startAt])

  if (failed) {
    return (
      <div>
        <p className="music-dock__hint" role="status">구간 플레이어를 불러오지 못해 처음부터 재생되는 Spotify 플레이어를 표시해요.</p>
        <iframe title="Spotify podcast episode" src={content.embedUrl} allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" />
      </div>
    )
  }

  return (
    <div className="spotify-episode-embed">
      {!ready && <p className="music-dock__hint" role="status">Spotify 플레이어를 불러오는 중…</p>}
      <div ref={mountRef} />
    </div>
  )
}

function StarField() {
  return (
    <div className="star-field" aria-hidden="true">
      {stars.map((star, index) => (
        <i
          className={`background-star${star.blue ? ' background-star--blue' : ''}`}
          key={index}
          style={{
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            animationDelay: star.delay,
            animationDuration: star.duration,
          }}
        />
      ))}
    </div>
  )
}

function TinyCakeFriend() {
  return (
    <div className="tiny-cake-friend" aria-hidden="true">
      <svg className="friend-art" viewBox="0 0 180 150">
        <ellipse cx="90" cy="137" rx="39" ry="6" fill="#3b82f6" opacity=".2" />
        <path d="m75 119-7 13m38-13 7 13" fill="none" stroke="#f3f7ff" strokeLinecap="round" strokeWidth="8" />
        <path d="m63 82-17 12m70-13 13-19" fill="none" stroke="#f3f7ff" strokeLinecap="round" strokeWidth="9" />
        <path d="m46 94-6 4m6-4-2-7m2 7 7-2m76-19 3-8m-3 8 8-2m-8 2 1 8" fill="none" stroke="#f3f7ff" strokeLinecap="round" strokeWidth="4" />
        <path d="m63 76 54 0-8 48c-12 7-27 7-39 0z" fill="#f3f7ff" stroke="#9dc9ff" strokeWidth="2" />
        <path d="M60 75c-13-4-13-22-1-28-2-16 16-23 28-13 8-15 29-12 32 4 17-3 26 16 13 27-5 5-12 8-20 9" fill="#fff" stroke="#b8d7ff" strokeWidth="2.5" />
        <path d="M90 38V26" stroke="#3b82f6" strokeLinecap="round" strokeWidth="5" />
        <path d="M90 22c-1 4-5 5-4 8 0 3 2 4 4 4 3 0 5-2 5-4 0-3-3-5-5-8z" fill="#79b8ff" stroke="#fff" strokeWidth="1" />
        <path d="M90 26v10" stroke="#fff" strokeWidth="1.3" opacity=".85" />
        <circle cx="78" cy="78" r="2.3" fill="#244d83" />
        <circle cx="102" cy="78" r="2.3" fill="#244d83" />
        <path d="M84 86c3 4 9 4 12 0" fill="none" stroke="#3b6090" strokeLinecap="round" strokeWidth="2.4" />
        <circle cx="70" cy="84" r="2.4" fill="#79b8ff" opacity=".65" />
        <circle cx="110" cy="84" r="2.4" fill="#79b8ff" opacity=".65" />
        <path d="m60 60 3-7 3 7 7 3-7 3-3 7-3-7-7-3z" fill="#79b8ff" opacity=".85" />
        <g className="friend-arm-wave" fill="none" stroke="#f3f7ff" strokeLinecap="round" strokeWidth="5">
          <path d="m126 67 13-15" />
          <path d="m139 52 1-7m-1 7 7-3m-7 3 5 5" />
        </g>
      </svg>
    </div>
  )
}

function CakeScene({
  extinguished,
  onBlowOut,
  wishVisible,
  continueVisible,
  resetWish,
  onSeeCard,
}: {
  extinguished: boolean
  onBlowOut: () => void
  wishVisible: boolean
  continueVisible: boolean
  resetWish: () => void
  onSeeCard: () => void
}) {
  return (
    <div className={`birthday-content${extinguished ? ' birthday-content--extinguished' : ''}`}>
      <img className="birthday-poster" src={birthdayPoster} alt="Wait, there's one more thing. Make a wish, then tap a candle. Tap either candle to blow it out." />
      <svg className="poster-flame poster-flame--two" viewBox="0 0 32 54" aria-hidden="true">
        <path className="poster-flame__glow" d="M16 1C14 14 2 23 3 37c1 10 6 15 13 15s12-5 13-15C30 23 18 14 16 1Z" />
        <path className="poster-flame__core" d="M16 17c-2 8-7 13-6 21 0 5 2 8 6 8s6-3 6-8c1-8-4-13-6-21Z" />
      </svg>
      <svg className="poster-flame poster-flame--zero" viewBox="0 0 32 54" aria-hidden="true">
        <path className="poster-flame__glow" d="M16 1C14 14 2 23 3 37c1 10 6 15 13 15s12-5 13-15C30 23 18 14 16 1Z" />
        <path className="poster-flame__core" d="M16 17c-2 8-7 13-6 21 0 5 2 8 6 8s6-3 6-8c1-8-4-13-6-21Z" />
      </svg>
      <svg className="poster-smoke poster-smoke--two" viewBox="0 0 36 72" aria-hidden="true"><path d="M19 67c-18-14 18-20 1-35S25 10 16 3" /></svg>
      <svg className="poster-smoke poster-smoke--zero" viewBox="0 0 36 72" aria-hidden="true"><path d="M19 67c-18-14 18-20 1-35S25 10 16 3" /></svg>
      <button
        className="poster-candle-hit poster-candle-hit--two"
        onClick={onBlowOut}
        aria-label={`Number 2 candle ${extinguished ? 'is out' : 'is lit'}`}
        disabled={extinguished}
      >
      </button>
      <button
        className="poster-candle-hit poster-candle-hit--zero"
        onClick={onBlowOut}
        aria-label={`Number 0 candle ${extinguished ? 'is out' : 'is lit'}`}
        disabled={extinguished}
      >
      </button>
      {wishVisible && (
        <div className="poster-wish-copy" aria-live="polite" aria-atomic="true">
          <p className="wish-question">Wish received. Keep it secret <span className="text-emoji">🤫</span></p>
          <p className="wish-response">I hope today stays with you for a long time.</p>
        </div>
      )}
      <div className="birthday-actions">
        {continueVisible && (
          <>
            <button className="primary-button primary-button--small" onClick={onSeeCard}>See the card again</button>
            <button className="replay-button replay-button--light" onClick={resetWish}>Wish once more</button>
          </>
        )}
      </div>
    </div>
  )
}

function App() {
  const [scene, setScene] = useState<Scene>('message')
  const [exiting, setExiting] = useState(false)
  const [cardSide, setCardSide] = useState<CardSide>('photo')
  const [extinguished, setExtinguished] = useState(false)
  const [wishVisible, setWishVisible] = useState(false)
  const [continueVisible, setContinueVisible] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [draftPhotoFile, setDraftPhotoFile] = useState<File | null>(null)
  const [musicFile, setMusicFile] = useState<File | null>(null)
  const [draftMusicFile, setDraftMusicFile] = useState<File | null>(null)
  const [musicMode, setMusicMode] = useState<MusicMode>('file')
  const [draftMusicMode, setDraftMusicMode] = useState<MusicMode>('file')
  const [spotifyLink, setSpotifyLink] = useState('')
  const [spotifyDraft, setSpotifyDraft] = useState('')
  const [spotifyStartAt, setSpotifyStartAt] = useState(0)
  const [spotifyStartAtDraft, setSpotifyStartAtDraft] = useState('0')
  const [playbackHint, setPlaybackHint] = useState('')
  const [photoPosition, setPhotoPosition] = useState({ x: 50, y: 50 })
  const [draftPhotoPosition, setDraftPhotoPosition] = useState({ x: 50, y: 50 })
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorError, setEditorError] = useState('')
  const sceneHeadingRef = useRef<HTMLHeadingElement>(null)
  const editorDialogRef = useRef<HTMLDialogElement>(null)
  const musicInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const draftAudioRef = useRef<HTMLAudioElement>(null)
  const currentSceneRef = useRef<Scene>('message')
  const hasBlownOutRef = useRef(false)
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wishTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const continueTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const photoUrl = useObjectUrl(photoFile)
  const draftPhotoUrl = useObjectUrl(draftPhotoFile)
  const displayPhotoUrl = photoUrl ?? dominikaPhoto
  const draftDisplayPhotoUrl = draftPhotoUrl ?? dominikaPhoto
  const musicUrl = useObjectUrl(musicFile)
  const draftMusicUrl = useObjectUrl(draftMusicFile)
  const spotifyContent = getSpotifyContent(spotifyLink)
  const spotifyDraftContent = getSpotifyContent(spotifyDraft)
  const hasMusic = musicMode === 'file' ? Boolean(musicUrl) : Boolean(spotifyContent)

  useEffect(() => {
    if (currentSceneRef.current !== scene) {
      currentSceneRef.current = scene
      sceneHeadingRef.current?.focus({ preventScroll: true })
    }
  }, [scene])

  useEffect(() => {
    const dialog = editorDialogRef.current
    if (!dialog) return

    if (editorOpen && !dialog.open) {
      dialog.showModal()
      requestAnimationFrame(() => musicInputRef.current?.focus())
    } else if (!editorOpen && dialog.open) {
      dialog.close()
    }
  }, [editorOpen])

  useEffect(() => {
    if (musicMode !== 'file' || !musicUrl || !audioRef.current) return

    const audio = audioRef.current
    audio.currentTime = 0
    audio.play().then(() => {
      setPlaybackHint('')
    }).catch(() => {
      setPlaybackHint('브라우저가 자동 재생을 막았어요. 아래 재생 버튼을 눌러 주세요.')
    })
  }, [musicMode, musicUrl])

  useEffect(() => () => {
    if (transitionTimer.current) clearTimeout(transitionTimer.current)
    if (wishTimer.current) clearTimeout(wishTimer.current)
    if (continueTimer.current) clearTimeout(continueTimer.current)
  }, [])

  const moveTo = (nextScene: Scene) => {
    if (exiting || nextScene === scene) return
    setExiting(true)
    if (transitionTimer.current) clearTimeout(transitionTimer.current)
    transitionTimer.current = setTimeout(() => {
      setScene(nextScene)
      setExiting(false)
    }, 220)
  }

  const blowOut = () => {
    if (hasBlownOutRef.current) return
    hasBlownOutRef.current = true
    setExtinguished(true)
    wishTimer.current = setTimeout(() => setWishVisible(true), 1050)
    continueTimer.current = setTimeout(() => setContinueVisible(true), 2500)
  }

  const resetWish = () => {
    if (wishTimer.current) clearTimeout(wishTimer.current)
    if (continueTimer.current) clearTimeout(continueTimer.current)
    hasBlownOutRef.current = false
    setExtinguished(false)
    setWishVisible(false)
    setContinueVisible(false)
  }

  const openEditor = () => {
    setDraftPhotoFile(photoFile)
    setDraftMusicFile(musicMode === 'file' ? musicFile : null)
    setDraftMusicMode(musicMode)
    setSpotifyDraft(musicMode === 'spotify' ? spotifyLink : '')
    setSpotifyStartAtDraft(String(spotifyStartAt))
    setDraftPhotoPosition(photoPosition)
    setEditorError('')
    setEditorOpen(true)
  }

  const closeEditor = () => {
    draftAudioRef.current?.pause()
    setDraftPhotoFile(photoFile)
    setDraftMusicFile(musicMode === 'file' ? musicFile : null)
    setDraftMusicMode(musicMode)
    setSpotifyDraft(musicMode === 'spotify' ? spotifyLink : '')
    setSpotifyStartAtDraft(String(spotifyStartAt))
    setDraftPhotoPosition(photoPosition)
    setEditorError('')
    setEditorOpen(false)
  }

  const saveEditor = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    draftAudioRef.current?.pause()
    const nextSpotifyLink = spotifyDraft.trim()
    const nextSpotifyContent = getSpotifyContent(nextSpotifyLink)
    const nextStartAt = Number(spotifyStartAtDraft)

    if (draftMusicMode === 'spotify' && nextSpotifyLink && !nextSpotifyContent) {
      setEditorError('Spotify 곡 또는 팟캐스트 링크를 확인해 주세요. open.spotify.com의 공유 링크를 붙여 넣어 주세요.')
      return
    }
    if (draftMusicMode === 'spotify' && nextSpotifyContent?.kind === 'episode'
      && (!Number.isInteger(nextStartAt) || nextStartAt < 0 || nextStartAt > 86400)) {
      setEditorError('팟캐스트 시작 지점은 0초부터 86,400초 사이의 정수로 입력해 주세요.')
      return
    }

    setPhotoFile(draftPhotoFile)
    setMusicMode(draftMusicMode)
    setMusicFile(draftMusicMode === 'file' ? draftMusicFile : null)
    setSpotifyLink(draftMusicMode === 'spotify' ? nextSpotifyLink : '')
    setSpotifyStartAt(draftMusicMode === 'spotify' && nextSpotifyContent?.kind === 'episode' ? nextStartAt : 0)
    setPhotoPosition(draftPhotoPosition)
    setPlaybackHint('')
    setEditorError('')
    setEditorOpen(false)
  }

  const choosePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    if (!file) return
    event.currentTarget.value = ''

    if (!file.type.startsWith('image/')) {
      setEditorError('이미지 파일을 선택해 주세요.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setEditorError('사진은 10MB 이하 파일을 선택해 주세요.')
      return
    }

    setDraftPhotoFile(file)
    setDraftPhotoPosition({ x: 50, y: 50 })
    setEditorError('')
  }

  const chooseMusic = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    if (!file) return
    event.currentTarget.value = ''

    const supportedType = /\.(mp3|m4a|wav|ogg)$/i.test(file.name)
      || ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/opus'].includes(file.type)
    if (!supportedType) {
      setEditorError('MP3, M4A, WAV, OGG 같은 오디오 파일을 선택해 주세요.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setEditorError('노래는 20MB 이하 파일을 선택해 주세요.')
      return
    }

    setDraftMusicFile(file)
    setDraftMusicMode('file')
    setPlaybackHint('')
    setEditorError('')
  }

  const openCard = () => {
    if (musicMode === 'file' && musicUrl && audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {
        setPlaybackHint('브라우저가 자동 재생을 막았어요. 아래 재생 버튼을 눌러 주세요.')
      })
    }
    setCardSide('letter')
    moveTo('message')
  }

  return (
    <main className="experience">
      <StarField />
      <section
        className={`scene scene--${scene}${exiting ? ' scene--exit' : ''}${hasMusic ? ' scene--with-music' : ''}`}
        aria-label={scene === 'surprise' ? 'Birthday card arrival' : scene === 'birthday' ? 'Birthday wish' : 'Birthday card'}
      >
        {scene === 'surprise' && (
          <div className="surprise-content">
            <p className="eyebrow">a little birthday surprise</p>
            <div
              className="cover-card"
              role="group"
              aria-label="Birthday card photo for Dominika"
            >
              <div className="cover-card__art">
                <img
                  className="card-photo"
                  src={displayPhotoUrl}
                  alt="Dominika in her birthday portrait"
                  style={{ objectPosition: `${photoPosition.x}% ${photoPosition.y}%` }}
                />
              </div>
              <div className="cover-card__copy">
                <p>made for Dominika</p>
                <h1 ref={sceneHeadingRef} tabIndex={-1}>Happy 20th Birthday!</h1>
              </div>
            </div>
            <p className="arrival-copy">Hey Dominika, there's a little letter waiting inside.</p>
            <button className="primary-button" onClick={openCard}>
              Open your card <span aria-hidden="true">✦</span>
            </button>
            <button className="editor-trigger" type="button" onClick={openEditor}>
              Customize photo and music
            </button>
          </div>
        )}

        {scene === 'message' && (
          <div className="message-content">
            <div className="reader-heading">
              <div className="reader-heading__topline">
                <p className="eyebrow">a birthday card for you</p>
                <button className="reader-edit" type="button" onClick={openEditor}>Edit photo and music</button>
              </div>
              <h1 ref={sceneHeadingRef} tabIndex={-1}>Happy 20th, Dominika.</h1>
            </div>
            <div className="card-side-switch" aria-label="Choose a side of the card">
              <button
                className={cardSide === 'photo' ? 'is-selected' : ''}
                type="button"
                aria-pressed={cardSide === 'photo'}
                onClick={() => setCardSide('photo')}
              >
                Photo
              </button>
              <button
                className={cardSide === 'letter' ? 'is-selected' : ''}
                type="button"
                aria-pressed={cardSide === 'letter'}
                onClick={() => setCardSide('letter')}
              >
                Letter
              </button>
            </div>
            <article
              className={`birthday-card birthday-card--${cardSide}`}
              key={cardSide}
              aria-label={cardSide === 'photo' ? 'Front of the birthday card' : 'Back of the birthday card'}
            >
              {cardSide === 'photo' ? (
                <div className="photo-side">
                  <div className="photo-side__art">
                    <img
                      className="card-photo"
                      src={displayPhotoUrl}
                      alt="Dominika in her birthday portrait"
                      style={{ objectPosition: `${photoPosition.x}% ${photoPosition.y}%` }}
                    />
                    <span className="photo-side__spark photo-side__spark--one" aria-hidden="true">✦</span>
                    <span className="photo-side__spark photo-side__spark--two" aria-hidden="true">✧</span>
                  </div>
                  <div className="photo-side__copy">
                    <p className="card-recipient">a day to celebrate you</p>
                    <h2>Happy 20th Birthday!</h2>
                    <p>Wishing you a day full of joy, love &amp; a little magic.</p>
                  </div>
                  <button className="text-button" type="button" onClick={() => setCardSide('letter')}>
                    Read the letter <span aria-hidden="true">↗</span>
                  </button>
                </div>
              ) : (
                <div className="letter-side">
                  <div className="letter-stamp" aria-hidden="true"><span>✦</span><small>20</small></div>
                  <p className="letter-kicker">for your 20th birthday</p>
                  <h2>Happy Birthday,<br /><span>Dominika!</span> <span className="text-emoji">💗</span></h2>
                  <div className="letter-body">
                    <p>I wanted to make you something a little different instead of just sending a birthday message.</p>
                    <p>I hope this new chapter brings you beautiful memories, unexpected adventures, lots of laughter, and plenty of reasons to smile.</p>
                    <p>And I hope this little surprise made you smile too. :)</p>
                    <p className="letter-wish">Enjoy your day, birthday girl! <span className="text-emoji">✨</span></p>
                  </div>
                  <div className="music-note" role="note">
                    <span className="music-note__symbol" aria-hidden="true">♪</span>
                    <div>
                      <p>{hasMusic ? 'A song is tucked into this card.' : 'No song was added to this card.'}</p>
                      <span>{!hasMusic
                        ? 'Take your time with the letter.'
                        : musicMode === 'file'
                          ? 'It starts when this page opens. If autoplay is blocked, press play below.'
                          : spotifyContent?.kind === 'episode' && spotifyStartAt > 0
                            ? `The episode starts at ${formatEpisodeStart(spotifyStartAt)}. Press play in Spotify below.`
                            : 'Press play in the Spotify player below when you are ready.'}</span>
                    </div>
                  </div>
                  <div className="last-rule">
                    <div>
                      <p className="rule-lead">One last rule...</p>
                      <p className="rule-copy">You're not allowed to be sad today. It's your birthday! <span className="text-emoji">😤🎂</span></p>
                    </div>
                    <div className="last-rule__friend"><TinyCakeFriend /></div>
                  </div>
                  <div className="letter-footer">
                    <p>Made just for Dominika <span className="text-emoji">💗</span></p>
                    <button className="primary-button primary-button--small" onClick={() => moveTo('birthday')}>
                      One last thing <span aria-hidden="true">✦</span>
                    </button>
                  </div>
                </div>
              )}
            </article>
          </div>
        )}

        {scene === 'birthday' && (
          <CakeScene
            extinguished={extinguished}
            onBlowOut={blowOut}
            wishVisible={wishVisible}
            continueVisible={continueVisible}
            resetWish={resetWish}
            onSeeCard={() => { setCardSide('letter'); moveTo('message') }}
          />
        )}
      </section>
      <div className={`scene-progress scene-progress--${scene}`} aria-hidden="true">
        {(['message', 'birthday'] as Scene[]).map((item) => (
          <span key={item} className={scene === item ? 'is-active' : ''} />
        ))}
      </div>
      {hasMusic && (
        <div
          className={`music-dock${scene === 'surprise' ? ' music-dock--hidden' : ''}`}
          role="region"
          aria-label="카드에 담긴 노래 재생"
          aria-hidden={scene === 'surprise'}
        >
          {playbackHint && <p className="music-dock__hint" role="status">{playbackHint}</p>}
          {musicMode === 'file' && musicUrl ? (
            <audio
              ref={audioRef}
              className="music-dock__audio"
              src={musicUrl}
              controls
              preload="metadata"
              aria-label={`${musicFile?.name ?? '생일 카드 음악'} 재생`}
              onPlay={() => setPlaybackHint('')}
              onError={() => setPlaybackHint('이 오디오 형식은 재생할 수 없어요. MP3, M4A, WAV 파일을 골라 주세요.')}
            />
          ) : spotifyContent ? (
            spotifyContent.kind === 'episode' && spotifyStartAt > 0 ? (
              <SpotifyEpisodeEmbed content={spotifyContent} startAt={spotifyStartAt} />
            ) : (
              <iframe
                title={spotifyContent.kind === 'episode' ? 'Spotify podcast episode' : 'Spotify birthday song'}
                src={spotifyContent.embedUrl}
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                allowFullScreen
              />
            )
          ) : null}
        </div>
      )}
      <dialog
        ref={editorDialogRef}
        className="card-editor"
        aria-labelledby="card-editor-title"
        onCancel={(event) => {
          event.preventDefault()
          closeEditor()
        }}
        onClose={() => setEditorOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeEditor()
        }}
      >
        <form className="card-editor__form" onSubmit={saveEditor}>
          <header className="card-editor__header">
            <div>
              <p className="editor-eyebrow">BIRTHDAY CARD</p>
              <h2 id="card-editor-title">사진과 노래 고르기</h2>
            </div>
            <button className="editor-close" type="button" onClick={closeEditor} aria-label="편집 닫기">×</button>
          </header>

          <div className="card-editor__body">
            <section className="editor-photo" aria-labelledby="editor-photo-title">
              <div className="editor-section-heading">
                <h3 id="editor-photo-title">카드 앞면 사진</h3>
                <span>선택</span>
              </div>
              <div className="editor-photo-preview">
                <img
                  className="card-photo"
                  src={draftDisplayPhotoUrl}
                  alt="카드 앞면 사진 미리보기"
                  style={{ objectPosition: `${draftPhotoPosition.x}% ${draftPhotoPosition.y}%` }}
                />
              </div>
              <label className="visually-hidden" htmlFor="card-photo-file">카드 앞면 사진 선택</label>
              <input
                id="card-photo-file"
                className="file-input"
                type="file"
                accept="image/*"
                aria-describedby="photo-file-hint"
                onChange={choosePhoto}
              />
              <p id="photo-file-hint" className="editor-hint">Dominika의 사진을 기본으로 넣었어요. 다른 사진으로 바꿀 수 있어요. JPG, PNG 등 최대 10MB.</p>
              {draftPhotoFile && (
                <button
                  className="editor-text-button"
                  type="button"
                  onClick={() => {
                    setDraftPhotoFile(null)
                    setDraftPhotoPosition({ x: 50, y: 50 })
                  }}
                >
                  기본 사진으로 돌아가기
                </button>
              )}
              {draftPhotoFile && (
                <div className="crop-controls">
                  <label>
                    <span>가로 위치 <output>{draftPhotoPosition.x}%</output></span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={draftPhotoPosition.x}
                      onChange={(event) => setDraftPhotoPosition((position) => ({ ...position, x: Number(event.currentTarget.value) }))}
                    />
                  </label>
                  <label>
                    <span>세로 위치 <output>{draftPhotoPosition.y}%</output></span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={draftPhotoPosition.y}
                      onChange={(event) => setDraftPhotoPosition((position) => ({ ...position, y: Number(event.currentTarget.value) }))}
                    />
                  </label>
                </div>
              )}
            </section>

            <section className="editor-song" aria-labelledby="editor-song-title">
              <div className="editor-section-heading">
                <h3 id="editor-song-title">함께 들을 노래</h3>
                <span>선택</span>
              </div>
              <div className="music-source-switch" role="group" aria-label="음악 선택 방식">
                <button
                  className={draftMusicMode === 'file' ? 'is-selected' : ''}
                  type="button"
                  aria-pressed={draftMusicMode === 'file'}
                  onClick={() => setDraftMusicMode('file')}
                >
                  파일
                </button>
                <button
                  className={draftMusicMode === 'spotify' ? 'is-selected' : ''}
                  type="button"
                  aria-pressed={draftMusicMode === 'spotify'}
                  onClick={() => setDraftMusicMode('spotify')}
                >
                  Spotify
                </button>
              </div>
              {draftMusicMode === 'file' ? (
                <>
                  <label className="editor-label" htmlFor="birthday-song-file">음악 파일</label>
                  <input
                    ref={musicInputRef}
                    id="birthday-song-file"
                    className="file-input"
                    type="file"
                    accept="audio/*,.mp3,.m4a,.wav,.ogg"
                    aria-describedby="music-file-hint"
                    onChange={chooseMusic}
                  />
                  <p id="music-file-hint" className="editor-hint">MP3, M4A, WAV, OGG 파일을 선택해 주세요. 카드 열기를 누르면 재생을 시도하고, 브라우저가 막으면 아래 재생 버튼을 누르면 돼요. 최대 20MB.</p>
                  {draftMusicFile && (
                    <p className="music-file-name" title={draftMusicFile.name}>선택한 노래: {draftMusicFile.name}</p>
                  )}
                  {draftMusicUrl && (
                    <audio ref={draftAudioRef} className="editor-audio-preview" src={draftMusicUrl} controls preload="metadata" aria-label="선택한 노래 미리 듣기" />
                  )}
                  {draftMusicFile && (
                    <button className="editor-text-button" type="button" onClick={() => {
                      draftAudioRef.current?.pause()
                      setDraftMusicFile(null)
                      setPlaybackHint('')
                    }}>
                      노래 빼기
                    </button>
                  )}
                </>
              ) : (
                <>
                  <label className="editor-label" htmlFor="spotify-track-link">Spotify 곡 또는 팟캐스트 링크</label>
                  <input
                    id="spotify-track-link"
                    className="editor-input"
                    type="url"
                    inputMode="url"
                    autoComplete="url"
                    aria-describedby="spotify-link-hint"
                    placeholder="https://open.spotify.com/track/..."
                    value={spotifyDraft}
                    onChange={(event) => {
                      setSpotifyDraft(event.currentTarget.value)
                      setDraftMusicMode('spotify')
                      setEditorError('')
                    }}
                  />
                  {spotifyDraftContent?.kind === 'episode' && (
                    <label className="editor-label" htmlFor="spotify-start-at">팟캐스트 시작 지점 (초)</label>
                  )}
                  {spotifyDraftContent?.kind === 'episode' && (
                    <input
                      id="spotify-start-at"
                      className="editor-input editor-input--short"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="86400"
                      step="1"
                      value={spotifyStartAtDraft}
                      aria-describedby="spotify-link-hint"
                      onChange={(event) => {
                        setSpotifyStartAtDraft(event.currentTarget.value)
                        setEditorError('')
                      }}
                    />
                  )}
                  <p id="spotify-link-hint" className="editor-hint">
                    {!spotifyDraftContent
                      ? 'Spotify에서 공유 → 링크 복사를 눌러 붙여 넣으세요. 곡은 처음부터 재생되고, 구간 지정은 팟캐스트만 지원해요.'
                      : spotifyDraftContent.kind === 'episode'
                        ? '팟캐스트는 시작할 초를 지정할 수 있어요. 예: 90초는 1분 30초부터 재생돼요.'
                        : 'Spotify 곡은 공식 플레이어로 재생할 수 있어요. 곡의 특정 구간부터 시작하려면 MP3 파일을 선택해 주세요.'}
                  </p>
                  {spotifyDraft && !spotifyDraftContent && (
                    <p className="editor-validation">open.spotify.com의 곡 또는 팟캐스트 링크를 확인해 주세요.</p>
                  )}
                  {spotifyDraft && (
                    <button className="editor-text-button" type="button" onClick={() => {
                      setSpotifyDraft('')
                      setSpotifyStartAtDraft('0')
                    }}>
                      Spotify 링크 지우기
                    </button>
                  )}
                </>
              )}
              {editorError && <p className="editor-error" role="alert">{editorError}</p>}
            </section>
          </div>

          <p className="editor-privacy-note">선택한 사진과 음악은 이 브라우저 미리보기에만 적용돼요. 기본 사진은 사이트에 포함되어 누구나 볼 수 있어요. 새로고침하면 선택한 사진과 음악은 초기화돼요.</p>
          <footer className="card-editor__footer">
            <button className="editor-cancel" type="button" onClick={closeEditor}>취소</button>
            <button className="primary-button primary-button--small" type="submit">미리보기에 적용</button>
          </footer>
        </form>
      </dialog>
    </main>
  )
}

export default App
