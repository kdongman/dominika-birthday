import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import dominikaPhoto from './assets/dominika.jpg'
import birthdayPoster from './assets/dominika-birthday-poster.png'
import birthdayFirstPage from './assets/birthday-first-page.png'
import './App.css'

type Scene = 'surprise' | 'message' | 'birthday'
type CardSide = 'photo' | 'letter'
type MusicMode = 'none' | 'file' | 'spotify'
type SpotifyContent = {
  kind: 'track' | 'episode'
  id: string
  url: string
  embedUrl: string
}

const DEFAULT_LETTER_MESSAGE = [
  'I wanted to make you something a little different instead of just sending a birthday message.',
  'I hope this new chapter brings you beautiful memories, unexpected adventures, lots of laughter, and plenty of reasons to smile.',
  'And I hope this little surprise made you smile too. :)',
  'Enjoy your day, birthday girl! ✨',
].join('\n\n')
const LETTER_STORAGE_KEY = 'dominika-birthday-letter-message'
const LETTER_MAX_LENGTH = 1200
let birthdayPosterLoad: Promise<void> | null = null

function getInitialLetterMessage() {
  const sharedMessage = new URLSearchParams(window.location.search).get('letter')
  if (sharedMessage?.trim()) return sharedMessage.slice(0, LETTER_MAX_LENGTH)

  try {
    return window.localStorage.getItem(LETTER_STORAGE_KEY) ?? DEFAULT_LETTER_MESSAGE
  } catch {
    return DEFAULT_LETTER_MESSAGE
  }
}

function getInitialCardMusic() {
  const searchParams = new URLSearchParams(window.location.search)
  const spotifyLink = searchParams.get('song') ?? ''
  const requestedStartAt = Number(searchParams.get('songStartAt') ?? 0)

  return {
    mode: spotifyLink ? 'spotify' as const : 'none' as const,
    spotifyLink,
    spotifyStartAt: Number.isInteger(requestedStartAt) && requestedStartAt >= 0 && requestedStartAt <= 86400
      ? requestedStartAt
      : 0,
  }
}

function preloadBirthdayPoster() {
  if (!birthdayPosterLoad) {
    birthdayPosterLoad = new Promise((resolve) => {
      const poster = new Image()
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        resolve()
      }
      const decode = () => {
        if (typeof poster.decode === 'function') {
          void poster.decode().then(finish, finish)
        } else {
          finish()
        }
      }

      poster.onload = decode
      poster.onerror = finish
      poster.src = birthdayPoster
      if (poster.complete) {
        if (poster.naturalWidth > 0) decode()
        else finish()
      }
    })
  }

  return birthdayPosterLoad
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
  const [posterReady, setPosterReady] = useState(false)

  return (
    <div className={`birthday-content${posterReady ? ' birthday-content--poster-ready' : ''}${extinguished ? ' birthday-content--extinguished' : ''}`}>
      <img
        className="birthday-poster"
        src={birthdayPoster}
        alt="Wait, there's one more thing. Make a wish, then tap a candle. Tap either candle to blow it out."
        onLoad={() => setPosterReady(true)}
      />
      {posterReady && (
        <>
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
        </>
      )}
      <button
        className="poster-candle-hit poster-candle-hit--two"
        onClick={onBlowOut}
        aria-label={`Number 2 candle ${extinguished ? 'is out' : 'is lit'}`}
        disabled={!posterReady || extinguished}
      >
      </button>
      <button
        className="poster-candle-hit poster-candle-hit--zero"
        onClick={onBlowOut}
        aria-label={`Number 0 candle ${extinguished ? 'is out' : 'is lit'}`}
        disabled={!posterReady || extinguished}
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
  const [initialCardMusic] = useState(getInitialCardMusic)
  const [scene, setScene] = useState<Scene>('surprise')
  const [exiting, setExiting] = useState(false)
  const [giftOpening, setGiftOpening] = useState(false)
  const [cardSide, setCardSide] = useState<CardSide>('photo')
  const [extinguished, setExtinguished] = useState(false)
  const [wishVisible, setWishVisible] = useState(false)
  const [continueVisible, setContinueVisible] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [draftPhotoFile, setDraftPhotoFile] = useState<File | null>(null)
  const [musicFile, setMusicFile] = useState<File | null>(null)
  const [draftMusicFile, setDraftMusicFile] = useState<File | null>(null)
  const [musicMode, setMusicMode] = useState<MusicMode>(initialCardMusic.mode)
  const [draftMusicMode, setDraftMusicMode] = useState<MusicMode>(initialCardMusic.mode)
  const [spotifyLink, setSpotifyLink] = useState(initialCardMusic.spotifyLink)
  const [spotifyDraft, setSpotifyDraft] = useState(initialCardMusic.spotifyLink)
  const [spotifyStartAt, setSpotifyStartAt] = useState(initialCardMusic.spotifyStartAt)
  const [spotifyStartAtDraft, setSpotifyStartAtDraft] = useState(String(initialCardMusic.spotifyStartAt))
  const [playbackHint, setPlaybackHint] = useState('')
  const [photoPosition, setPhotoPosition] = useState({ x: 50, y: 50 })
  const [draftPhotoPosition, setDraftPhotoPosition] = useState({ x: 50, y: 50 })
  const [letterMessage, setLetterMessage] = useState(getInitialLetterMessage)
  const [draftLetterMessage, setDraftLetterMessage] = useState(letterMessage)
  const [letterShareStatus, setLetterShareStatus] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorError, setEditorError] = useState('')
  const sceneHeadingRef = useRef<HTMLHeadingElement>(null)
  const editorDialogRef = useRef<HTMLDialogElement>(null)
  const musicInputRef = useRef<HTMLInputElement>(null)
  const letterInputRef = useRef<HTMLTextAreaElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const draftAudioRef = useRef<HTMLAudioElement>(null)
  const currentSceneRef = useRef<Scene>('surprise')
  const hasBlownOutRef = useRef(false)
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const giftOpenTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
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
  const hasMusic = musicMode === 'file' ? Boolean(musicUrl) : musicMode === 'spotify' && Boolean(spotifyContent)
  const letterParagraphs = letterMessage.trim().split(/\n\s*\n+/).map((paragraph) => paragraph.trim()).filter(Boolean)

  useEffect(() => {
    if (currentSceneRef.current !== scene) {
      currentSceneRef.current = scene
      sceneHeadingRef.current?.focus({ preventScroll: true })
    }
  }, [scene])

  useEffect(() => {
    if (scene === 'message' && giftOpening) setGiftOpening(false)
  }, [scene, giftOpening])

  useEffect(() => {
    if (scene === 'message') void preloadBirthdayPoster()
  }, [scene])

  useEffect(() => {
    const dialog = editorDialogRef.current
    if (!dialog) return

    if (editorOpen && !dialog.open) {
      dialog.showModal()
      requestAnimationFrame(() => letterInputRef.current?.focus())
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
    if (giftOpenTimer.current) clearTimeout(giftOpenTimer.current)
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
    setDraftLetterMessage(letterMessage)
    setLetterShareStatus('')
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
    setDraftLetterMessage(letterMessage)
    setLetterShareStatus('')
    setEditorError('')
    setEditorOpen(false)
  }

  const saveEditor = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    draftAudioRef.current?.pause()
    audioRef.current?.pause()
    const nextSpotifyLink = spotifyDraft.trim()
    const nextSpotifyContent = getSpotifyContent(nextSpotifyLink)
    const nextStartAt = Number(spotifyStartAtDraft)
    const nextLetterMessage = draftLetterMessage.trim()

    if (!nextLetterMessage) {
      setEditorError('편지 내용을 입력해 주세요.')
      return
    }

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
    const nextMusicMode = draftMusicMode === 'file' && !draftMusicFile ? 'none' : draftMusicMode
    setMusicMode(nextMusicMode)
    setMusicFile(nextMusicMode === 'file' ? draftMusicFile : null)
    setSpotifyLink(nextMusicMode === 'spotify' ? nextSpotifyLink : '')
    setSpotifyStartAt(nextMusicMode === 'spotify' && nextSpotifyContent?.kind === 'episode' ? nextStartAt : 0)
    setPhotoPosition(draftPhotoPosition)
    setLetterMessage(nextLetterMessage)
    try {
      window.localStorage.setItem(LETTER_STORAGE_KEY, nextLetterMessage)
    } catch {
      // The letter still updates for this visit when browser storage is unavailable.
    }
    setPlaybackHint('')
    setEditorError('')
    setEditorOpen(false)
  }

  const copyPersonalizedLetterLink = async () => {
    const message = draftLetterMessage.trim()
    if (!message) {
      setEditorError('편지 내용을 입력해 주세요.')
      return
    }

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

    const personalizedUrl = new URL(window.location.href)
    personalizedUrl.searchParams.set('letter', message)
    personalizedUrl.searchParams.delete('song')
    personalizedUrl.searchParams.delete('songStartAt')
    if (draftMusicMode === 'spotify' && nextSpotifyContent) {
      personalizedUrl.searchParams.set('song', nextSpotifyLink)
      if (nextSpotifyContent.kind === 'episode' && nextStartAt > 0) {
        personalizedUrl.searchParams.set('songStartAt', String(nextStartAt))
      }
    }
    try {
      await navigator.clipboard.writeText(personalizedUrl.toString())
      setEditorError('')
      setLetterShareStatus(draftMusicMode === 'spotify' && nextSpotifyContent
        ? '편지와 Spotify 노래가 들어간 링크를 복사했어요.'
        : draftMusicMode === 'file' && draftMusicFile
          ? '편지 링크를 복사했어요. 선택한 음악 파일은 이 브라우저에서만 재생돼요.'
          : '편지 문구를 담은 링크를 복사했어요. 노래는 추가되지 않은 상태예요.')
    } catch {
      setLetterShareStatus('링크를 복사하지 못했어요. 브라우저 주소창의 사이트 주소를 확인해 주세요.')
    }
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
    if (giftOpening || exiting) return
    if (musicMode === 'file' && musicUrl && audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {
        setPlaybackHint('브라우저가 자동 재생을 막았어요. 아래 재생 버튼을 눌러 주세요.')
      })
    }
    setCardSide('photo')
    setGiftOpening(true)
    giftOpenTimer.current = setTimeout(() => moveTo('message'), 820)
  }

  const openBirthdayScene = async () => {
    await preloadBirthdayPoster()
    moveTo('birthday')
  }

  return (
    <main className="experience">
      <StarField />
      <section
        className={`scene scene--${scene}${exiting ? ' scene--exit' : ''}${giftOpening ? ' scene--opening' : ''}${hasMusic ? ' scene--with-music' : ''}`}
        aria-label={scene === 'surprise' ? 'Birthday card arrival' : scene === 'birthday' ? 'Birthday wish' : 'Birthday card'}
      >
        {scene === 'surprise' && (
          <div className={`surprise-artboard${giftOpening ? ' surprise-artboard--opening' : ''}`}>
            <img
              className="surprise-artboard__image"
              src={birthdayFirstPage}
              alt="A birthday letter for Dominika, tucked into a sealed envelope."
              draggable={false}
            />
            <div className="surprise-opening-note" aria-hidden="true">
              <span>A little birthday wish</span>
              <strong>For Dominika</strong>
              <i>with love</i>
              <b>♥</b>
            </div>
            <button
              className="surprise-artboard__hit surprise-artboard__hit--envelope"
              type="button"
              onClick={openCard}
              disabled={giftOpening || exiting}
              aria-label="Open the birthday envelope"
            />
            <button
              className="surprise-artboard__hit surprise-artboard__hit--open"
              type="button"
              onClick={openCard}
              disabled={giftOpening || exiting}
              aria-label="Open your letter"
            />
            <button
              className="surprise-artboard__hit surprise-artboard__hit--customize"
              type="button"
              onClick={openEditor}
              disabled={giftOpening || exiting}
              aria-label="Customize your card"
            />
          </div>
        )}

        {scene === 'message' && (
          <div className="message-content">
            <div className="reader-heading">
              <div className="reader-heading__topline">
                <p className="eyebrow">a birthday card for you</p>
                <button className="reader-edit" type="button" onClick={openEditor}>Edit card</button>
              </div>
              <h1 ref={sceneHeadingRef} tabIndex={-1}>Happy 20th, Dominika.</h1>
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
                    <p className="card-recipient">✦ MADE JUST FOR YOU ✦</p>
                    <h2>For you, birthday girl. ♡</h2>
                    <p className="photocard-description">I made this little surprise hoping it'd make you smile.</p>
                    <p className="photocard-description">Hope you have the loveliest day. 💙</p>
                  </div>
                  <button className="text-button" type="button" onClick={() => setCardSide('letter')}>
                    Read your letter <span aria-hidden="true">↗</span>
                  </button>
                </div>
              ) : (
                <div className="letter-side">
                  <div className="letter-stamp" aria-hidden="true"><span>✦</span><small>20</small></div>
                  <p className="letter-kicker">for your 20th birthday</p>
                  <h2>Happy Birthday,<br /><span>Dominika!</span> <span className="text-emoji">💗</span></h2>
                  <div className="letter-body">
                    {letterParagraphs.map((paragraph, index) => (
                      <p className={index === letterParagraphs.length - 1 ? 'letter-wish' : undefined} key={`${index}-${paragraph}`}>
                        {paragraph}
                      </p>
                    ))}
                  </div>
                  <div className="letter-footer">
                    <div className="letter-footer__note">
                      <p>Made just for Dominika <span className="text-emoji">💗</span></p>
                      <button className="text-button letter-back-link" type="button" onClick={() => setCardSide('photo')}>
                        Back to photo <span aria-hidden="true">↗</span>
                      </button>
                    </div>
                    <button className="primary-button primary-button--small" onClick={() => { void openBirthdayScene() }}>
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
        {(['surprise', 'message', 'birthday'] as Scene[]).map((item) => (
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
              <h2 id="card-editor-title">카드 편집</h2>
            </div>
            <button className="editor-close" type="button" onClick={closeEditor} aria-label="편집 닫기">×</button>
          </header>

          <section className="editor-letter" aria-labelledby="editor-letter-title">
            <div className="editor-section-heading">
              <h3 id="editor-letter-title">편지 내용</h3>
              <span>직접 수정</span>
            </div>
            <label className="visually-hidden" htmlFor="birthday-letter-message">편지 내용 수정</label>
            <textarea
              ref={letterInputRef}
              id="birthday-letter-message"
              className="editor-textarea"
              value={draftLetterMessage}
              maxLength={LETTER_MAX_LENGTH}
              rows={6}
              aria-describedby="letter-message-hint"
              onChange={(event) => {
                setDraftLetterMessage(event.currentTarget.value)
                setLetterShareStatus('')
                setEditorError('')
              }}
            />
            <div className="editor-letter-meta">
              <p id="letter-message-hint" className="editor-hint">빈 줄을 넣으면 문단이 나뉘어요. 저장하면 이 브라우저에 기억돼요.</p>
              <span>{draftLetterMessage.length}/{LETTER_MAX_LENGTH}</span>
            </div>
            <div className="editor-letter-actions">
              <button className="editor-text-button" type="button" onClick={() => {
                setDraftLetterMessage(DEFAULT_LETTER_MESSAGE)
                setLetterShareStatus('')
                setEditorError('')
              }}>
                기본 문구로 되돌리기
              </button>
              <button className="editor-share-link" type="button" onClick={() => { void copyPersonalizedLetterLink() }}>
                내 편지 링크 복사
              </button>
            </div>
            {letterShareStatus && <p className="editor-share-status" role="status">{letterShareStatus}</p>}
          </section>

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
                <span>선택 사항</span>
              </div>
              <div className="music-source-switch" role="group" aria-label="음악 선택 방식">
                <button
                  className={draftMusicMode === 'none' ? 'is-selected' : ''}
                  type="button"
                  aria-pressed={draftMusicMode === 'none'}
                  onClick={() => {
                    draftAudioRef.current?.pause()
                    audioRef.current?.pause()
                    setDraftMusicMode('none')
                    setPlaybackHint('')
                  }}
                >
                  없음
                </button>
                <button
                  className={draftMusicMode === 'file' ? 'is-selected' : ''}
                  type="button"
                  aria-pressed={draftMusicMode === 'file'}
                  onClick={() => {
                    draftAudioRef.current?.pause()
                    setDraftMusicMode('file')
                  }}
                >
                  파일
                </button>
                <button
                  className={draftMusicMode === 'spotify' ? 'is-selected' : ''}
                  type="button"
                  aria-pressed={draftMusicMode === 'spotify'}
                  onClick={() => {
                    draftAudioRef.current?.pause()
                    setDraftMusicMode('spotify')
                  }}
                >
                  Spotify
                </button>
              </div>
              {draftMusicMode === 'none' ? (
                <p className="editor-hint editor-no-song">노래 없이 카드만 보내도 괜찮아요. 원하면 파일이나 Spotify 곡을 추가할 수 있어요.</p>
              ) : draftMusicMode === 'file' ? (
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
            </section>
          </div>

          {editorError && <p className="editor-error" role="alert">{editorError}</p>}
          <p className="editor-privacy-note">사진과 음악 파일은 이 브라우저 미리보기에만 적용돼요. 편지 내용과 Spotify 링크는 개인화 링크에 담아 공유할 수 있어요.</p>
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
