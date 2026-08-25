import React, { useRef, useState, useEffect } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, push, set } from 'firebase/database';
import { useAuth } from '@/lib/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getDatabase(app);

export default function DrawingBoard({ boardId = 'load-b', onPostSuccess }) {
  const canvasRef = useRef(null);
  const { user } = useAuth();

  const [penSize, setPenSize] = useState(2);
  const [eraserSize, setEraserSize] = useState(10);
  const [activeTool, setActiveTool] = useState('pen');
  const [rgb, setRgb] = useState({ r: 0, g: 0, b: 0 });
  const [title, setTitle] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [prevPos, setPrevPos] = useState({ x: 0, y: 0 });
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (sec) => {
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const currentColorHex = `#${((1 << 24) + (rgb.r << 16) + (rgb.g << 8) + rgb.b).toString(16).slice(1)}`;

  const paletteColors = [
    '#ffffff', '#000000', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff',
    '#808080', '#800000', '#808000', '#008000', '#008080', '#000080', '#800080', '#ff8040'
  ];

  const handlePaletteClick = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    setRgb({ r, g, b });
    setActiveTool('pen');
  };

  const getPos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  const drawLine = (p1, p2) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    if (activeTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = eraserSize;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    } else {
      ctx.fillStyle = currentColorHex;
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      for (let i = 0; i < dist; i += 1) {
        const x = p1.x + Math.cos(angle) * i;
        const y = p1.y + Math.sin(angle) * i;
        ctx.fillRect(Math.floor(x), Math.floor(y), penSize, penSize);
      }
    }
    ctx.restore();
  };

  const startDrawing = (e) => {
    setIsDrawing(true);
    setPrevPos(getPos(e));
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const currentPos = getPos(e);
    drawLine(prevPos, currentPos);
    setPrevPos(currentPos);
  };

  const stopDrawing = () => setIsDrawing(false);

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSaveToBoard = async () => {
    const postTitle = title.trim() || '무제';
    if (!canvasRef.current) return;

    setIsPosting(true);

    try {
      const imageBase64 = canvasRef.current.toDataURL('image/png');

      const postData = {
        id: `p_${Date.now()}`,
        boardId: boardId,
        title: postTitle,
        author: user?.nickname || user?.name || '익명화가',
        authorId: user?.id || 'guest',
        body: `<p><img src="${imageBase64}" alt="${postTitle}" style="max-width:100%; height:auto;" /></p>`,
        thumbSrc: imageBase64,
        category: '🎨그림',
        date: new Date().toISOString(),
        views: 0,
        comments: [],
      };

      if (db) {
        try {
          const newPostRef = push(ref(db, 'posts'));
          await set(newPostRef, postData);
        } catch (e) {
          console.log('Firebase skip');
        }
      }

      const storageKey = 'ohome.board.v1';
      const existing = localStorage.getItem(storageKey);
      let localPosts = existing ? JSON.parse(existing) : [];
      localPosts.unshift(postData);
      localStorage.setItem(storageKey, JSON.stringify(localPosts));

      alert('🎨 로드비에 성공적으로 업로드되었습니다!');
      setTitle('');
      handleClear();

      if (onPostSuccess) onPostSuccess(postData);
    } catch (err) {
      console.error(err);
      alert('등록 중 에러가 발생했습니다.');
    } finally {
      setIsPosting(false);
    }
  };

  const retroBoxStyle = {
    backgroundColor: '#c4c8c4',
    borderTop: '2px solid #ffffff',
    borderLeft: '2px solid #ffffff',
    borderRight: '2px solid #505050',
    borderBottom: '2px solid #505050',
    fontSize: '11px',
    color: '#000000',
    userSelect: 'none',
  };

  const retroBtnStyle = {
    backgroundColor: '#b8bcb8',
    borderTop: '1.5px solid #ffffff',
    borderLeft: '1.5px solid #ffffff',
    borderRight: '1.5px solid #404040',
    borderBottom: '1.5px solid #404040',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 'bold',
    textAlign: 'center',
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', width: '100%', padding: '10px 0' }}>
      <div style={{ ...retroBoxStyle, padding: '8px', width: '600px' }}>
        
        {/* 상단바 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button onClick={handleSaveToBoard} disabled={isPosting} style={{ ...retroBtnStyle, padding: '4px 10px' }}>
              {isPosting ? '올리는 중...' : '올리기'}
            </button>
            <input
              type="text"
              placeholder="제목 입력..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ padding: '2px 6px', fontSize: '11px', width: '130px', border: '1px solid #808080' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
            {['✢', '◯', '▢', '〜', '＼', '•'].map((icon, idx) => (
              <div key={idx} style={{ ...retroBtnStyle, width: '22px', height: '22px', lineHeight: '20px' }}>{icon}</div>
            ))}
          </div>

          <div style={{ fontSize: '10px', backgroundColor: '#a8aca8', padding: '2px 6px', border: '1px solid #808080' }}>
            배율 1x [ |||||||||||||| ]
          </div>
        </div>

        {/* 메인 작업 영역 */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {/* 캔버스 */}
          <div style={{ border: '1px solid #000', backgroundColor: '#ffffff', width: '450px', height: '450px', cursor: 'crosshair' }}>
            <canvas
              ref={canvasRef}
              width={450}
              height={450}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
            />
          </div>

          {/* 비툴 툴바 */}
          <div style={{ width: '120px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            
            <div style={{ ...retroBoxStyle, padding: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>펜</span>
              <div style={{ display: 'flex', gap: '2px' }}>
                <button onClick={() => { setPenSize(Math.min(20, penSize + 1)); setActiveTool('pen'); }} style={{ ...retroBtnStyle, width: '14px' }}>▲</button>
                <button onClick={() => { setPenSize(Math.max(1, penSize - 1)); setActiveTool('pen'); }} style={{ ...retroBtnStyle, width: '14px' }}>▼</button>
              </div>
              <span>{penSize}px</span>
            </div>

            <div style={{ ...retroBoxStyle, padding: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>지우개</span>
              <div style={{ display: 'flex', gap: '2px' }}>
                <button onClick={() => { setEraserSize(Math.min(40, eraserSize + 2)); setActiveTool('eraser'); }} style={{ ...retroBtnStyle, width: '14px' }}>▲</button>
                <button onClick={() => { setEraserSize(Math.max(2, eraserSize - 2)); setActiveTool('eraser'); }} style={{ ...retroBtnStyle, width: '14px' }}>▼</button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '2px' }}>
              <button style={{ ...retroBtnStyle, flex: 1, padding: '2px' }}>채우기</button>
              <button style={{ ...retroBtnStyle, flex: 1, padding: '2px' }}>색추출</button>
            </div>

            <div style={{ ...retroBoxStyle, padding: '4px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2px', marginBottom: '6px' }}>
                {paletteColors.map((hex, i) => (
                  <div
                    key={i}
                    onClick={() => handlePaletteClick(hex)}
                    style={{ width: '18px', height: '14px', backgroundColor: hex, border: '1px solid #000', cursor: 'pointer' }}
                  />
                ))}
              </div>

              <div style={{ width: '100%', height: '16px', backgroundColor: currentColorHex, border: '1px solid #000', marginBottom: '6px' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <span style={{ color: 'red', fontWeight: 'bold' }}>R</span>
                  <input type="range" min="0" max="255" value={rgb.r} onChange={(e) => setRgb({ ...rgb, r: Number(e.target.value) })} style={{ flex: 1, height: '8px' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <span style={{ color: 'green', fontWeight: 'bold' }}>G</span>
                  <input type="range" min="0" max="255" value={rgb.g} onChange={(e) => setRgb({ ...rgb, g: Number(e.target.value) })} style={{ flex: 1, height: '8px' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <span style={{ color: 'blue', fontWeight: 'bold' }}>B</span>
                  <input type="range" min="0" max="255" value={rgb.b} onChange={(e) => setRgb({ ...rgb, b: Number(e.target.value) })} style={{ flex: 1, height: '8px' }} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '2px' }}>
              <button style={{ ...retroBtnStyle, flex: 1, padding: '2px' }}>UNDO</button>
              <button style={{ ...retroBtnStyle, flex: 1, padding: '2px' }}>REDO</button>
            </div>

            <div style={{ ...retroBoxStyle, padding: '4px', textAlign: 'center' }}>
              <div>마스크 일반모드</div>
              <div style={{ marginTop: '2px', fontWeight: 'bold' }}>{formatTimer(seconds)}</div>
            </div>

          </div>
        </div>

        {/* 하단 클리어 버튼 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
          <button onClick={handleClear} style={{ ...retroBtnStyle, padding: '4px 12px' }}>클리어</button>
          <div style={{ ...retroBoxStyle, padding: '2px 6px', fontSize: '10px' }}>Default Skin</div>
        </div>

      </div>
    </div>
  );
}
