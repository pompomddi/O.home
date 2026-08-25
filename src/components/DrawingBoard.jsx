import React, { useRef, useState, useEffect } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, onValue, set } from 'firebase/database';
import { useAuth } from '@/lib/auth';

// O.home 파이어베이스 설정 안전 연결
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

export default function DrawingBoard() {
  const canvasRef = useRef(null);
  const { user } = useAuth();

  const [brushType, setBrushType] = useState('pencil'); // pencil, airbrush, crayon, calligraphy, eraser
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [title, setTitle] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [prevPos, setPrevPos] = useState({ x: 0, y: 0 });

  // 비툴/윈도우 고전 팔레트
  const palette = [
    '#000000', '#7f7f7f', '#880015', '#ed1c24', '#ff79e0', '#ffc90e', '#fff200', '#22b14c', '#00a2e8', '#3f48cc', '#a349a4',
    '#ffffff', '#c3c3c3', '#b5e61d', '#99d9ea', '#7092be', '#c8bfe7', '#ffaec9', '#ffc899', '#f5e49e', '#d3d3d3'
  ];

  // 1. 실시간 캔버스 동기화 (Firebase)
  useEffect(() => {
    if (!db) return;
    const canvasDataRef = ref(db, 'live_canvas/image_data');

    const unsubscribe = onValue(canvasDataRef, (snapshot) => {
      const dataUrl = snapshot.val();
      if (dataUrl && canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        const img = new Image();
        img.src = dataUrl;
        img.onload = () => {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          ctx.drawImage(img, 0, 0);
        };
      }
    });

    return () => unsubscribe();
  }, []);

  const syncCanvasToFirebase = () => {
    if (!canvasRef.current || !db) return;
    const dataUrl = canvasRef.current.toDataURL();
    set(ref(db, 'live_canvas/image_data'), dataUrl);
  };

  // 좌표 계산
  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  // 브러시 그리기 연산
  const drawLine = (p1, p2) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    ctx.save();
    if (brushType === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = strokeWidth * 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    } else if (brushType === 'pencil') {
      // 도트 연필
      ctx.fillStyle = strokeColor;
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      for (let i = 0; i < dist; i += 1) {
        const x = p1.x + Math.cos(angle) * i;
        const y = p1.y + Math.sin(angle) * i;
        ctx.fillRect(Math.floor(x), Math.floor(y), strokeWidth, strokeWidth);
      }
    } else if (brushType === 'airbrush') {
      // 에어브러시 (수채화 질감)
      ctx.fillStyle = strokeColor;
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const density = strokeWidth * 3;
      for (let i = 0; i < dist; i += 2) {
        const currX = p1.x + Math.cos(angle) * i;
        const currY = p1.y + Math.sin(angle) * i;
        for (let j = 0; j < density; j++) {
          const offsetX = (Math.random() - 0.5) * strokeWidth * 2.5;
          const offsetY = (Math.random() - 0.5) * strokeWidth * 2.5;
          ctx.globalAlpha = 0.08;
          ctx.fillRect(currX + offsetX, currY + offsetY, 1.5, 1.5);
        }
      }
    } else if (brushType === 'crayon') {
      // 크레파스 (종이 거친 질감)
      ctx.fillStyle = strokeColor;
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      for (let i = 0; i < dist; i += 1) {
        const currX = p1.x + Math.cos(angle) * i;
        const currY = p1.y + Math.sin(angle) * i;
        for (let j = 0; j < strokeWidth * 2; j++) {
          if (Math.random() > 0.3) {
            const rx = (Math.random() - 0.5) * strokeWidth;
            const ry = (Math.random() - 0.5) * strokeWidth;
            ctx.globalAlpha = Math.random() * 0.7;
            ctx.fillRect(currX + rx, currY + ry, 1, 1);
          }
        }
      }
    } else if (brushType === 'calligraphy') {
      // 캘리그래피 / 서예 펜
      ctx.fillStyle = strokeColor;
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      for (let i = 0; i < dist; i += 1) {
        const x = p1.x + Math.cos(angle) * i;
        const y = p1.y + Math.sin(angle) * i;
        ctx.beginPath();
        ctx.moveTo(x - strokeWidth, y - strokeWidth);
        ctx.lineTo(x + strokeWidth, y + strokeWidth);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  const startDrawing = (e) => {
    setIsDrawing(true);
    const pos = getPos(e);
    setPrevPos(pos);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const currentPos = getPos(e);
    drawLine(prevPos, currentPos);
    setPrevPos(currentPos);
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      syncCanvasToFirebase();
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (db) set(ref(db, 'live_canvas/image_data'), '');
  };

  // 게시판 등록
  const handleSaveToBoard = async () => {
    if (!title.trim()) {
      alert('그림 제목을 입력해 주세요!');
      return;
    }
    if (!canvasRef.current) return;

    try {
      setIsPosting(true);
      const imageBase64 = canvasRef.current.toDataURL('image/png');

      const newPost = {
        id: `post_${Date.now()}`,
        boardId: 'main',
        title: title,
        author: user?.nickname || user?.name || '익명화가',
        authorId: user?.id || 'guest',
        body: `<p><img src="${imageBase64}" alt="${title}" style="max-width:100%; border-radius:8px;" /></p>`,
        category: '🎨그림판',
        date: new Date().toISOString(),
        comments: [],
        notice: false,
        secret: false
      };

      const existingKey = 'ohome.board.v1';
      const localData = localStorage.getItem(existingKey);
      let posts = localData ? JSON.parse(localData) : [];
      posts.unshift(newPost);
      localStorage.setItem(existingKey, JSON.stringify(posts));

      alert('🎨 게시판에 그림이 성공적으로 올랐습니다!');
      setTitle('');
      handleClear();
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '16px',
      width: '100%', maxWidth: '900px', margin: '0 auto', backgroundColor: '#c0c0c0',
      border: '2px solid #ffffff', boxShadow: 'inset -1px -1px #000, inset 1px 1px #fff'
    }}>
      {/* 상단 툴바 */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', backgroundColor: '#e0e0e0', padding: '10px 14px', border: '1px solid #808080'
      }}>
        {/* 브러시 종류 선택 */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {[
            { id: 'pencil', label: '✏️ 도트 연필' },
            { id: 'airbrush', label: '💨 에어브러시' },
            { id: 'crayon', label: '🖍️ 크레파스' },
            { id: 'calligraphy', label: '🖌️ 캘리그래피' },
            { id: 'eraser', label: '🧹 지우개' }
          ].map((b) => (
            <button
              key={b.id}
              onClick={() => setBrushType(b.id)}
              style={{
                padding: '5px 10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                backgroundColor: brushType === b.id ? '#ffffff' : '#d0d0d0',
                border: brushType === b.id ? '2px solid #000' : '1px solid #808080'
              }}
            >
              {b.label}
            </button>
          ))}
        </div>

        {/* 굵기 조절 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 'bold' }}>
          <span>굵기: {strokeWidth}px</span>
          <input type="range" min="1" max="30" value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))} style={{ cursor: 'pointer', width: '80px' }} />
        </div>

        {/* 색상 피커 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold' }}>색상:</span>
          <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} style={{ width: '28px', height: '28px', border: '1px solid #000', cursor: 'pointer', padding: 0 }} />
        </div>

        <button onClick={handleClear} style={{ padding: '5px 10px', fontSize: '12px', cursor: 'pointer', backgroundColor: '#fff', border: '1px solid #808080' }}>
          💥 전체지우기
        </button>
      </div>

      {/* 팔레트 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', width: '100%', justifyContent: 'center', background: '#d0d0d0', padding: '6px', border: '1px solid #808080' }}>
        {palette.map((color, idx) => (
          <button
            key={idx}
            onClick={() => { setStrokeColor(color); if (brushType === 'eraser') setBrushType('pencil'); }}
            style={{ width: '22px', height: '22px', backgroundColor: color, border: strokeColor === color && brushType !== 'eraser' ? '2px solid #000' : '1px solid #808080', cursor: 'pointer' }}
          />
        ))}
      </div>

      {/* 레트로 캔버스 (가로 800 x 세로 520) */}
      <div style={{ width: '100%', height: '520px', backgroundColor: '#ffffff', border: '2px solid #000', cursor: 'crosshair' }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={520}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>

      {/* 게시판 등록 하단 바 */}
      <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '6px' }}>
        <input
          type="text"
          placeholder="그림 제목을 입력하세요..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ flex: 1, padding: '8px 12px', border: '2px solid #808080', fontSize: '14px', outline: 'none' }}
        />
        <button
          onClick={handleSaveToBoard}
          disabled={isPosting}
          style={{
            padding: '8px 20px', backgroundColor: '#008080', color: '#fff', fontWeight: 'bold',
            border: '2px solid #004040', cursor: 'pointer', fontSize: '14px'
          }}
        >
          {isPosting ? '등록 중...' : '🚀 게시판에 그림 등록'}
        </button>
      </div>
    </div>
  );
}
