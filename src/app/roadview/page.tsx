'use client';
// 그림게시판 로드뷰 (4.10) — 비툴 그림판 강제 노출 버전
import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import {
  useLocalList, newId, fmtDate, Comment,
  CommentRow, COMMENT_KEY, COMMENT_SEED, commentsFor,
} from '@/lib/postStore';
import { RoadItem, ROAD_SEED } from '@/lib/galleryStore';
import { SearchBar, KInput } from '@/components/ui/Kit';
import { putBlob, useBlobUrl } from '@/lib/blobStore';
import { Modal, ConfirmModal, useConfirmDelete } from '@/components/ui/Modal';
import { EditableDesc, PageTitle } from '@/components/ui/PageText';
import { KCheck } from '@/components/ui/Kit';
import { useToast } from '@/components/ui/Toast';
import { pushNotif } from '@/lib/notifStore';
import { useMenuSettings, MenuPerm } from '@/lib/menuStore';
import { GuestIdBar } from '@/components/ui/GuestId';
import { fileDrop } from '@/lib/dnd';

const PAGE_SIZE = 4;
const FOLD_LABEL = { spoiler: '스포일러', adult: '수위 주의' };

// ==========================================
// 🎨 레트로 비툴 그림판 컴포넌트
// ==========================================
function RetroDrawingBoard({ onDrawUpload }: { onDrawUpload: (base64: string, title: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [penSize, setPenSize] = useState(2);
  const [eraserSize, setEraserSize] = useState(10);
  const [activeTool, setActiveTool] = useState<'pen' | 'eraser'>('pen');
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

  const formatTimer = (sec: number) => {
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

  const handlePaletteClick = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    setRgb({ r, g, b });
    setActiveTool('pen');
  };

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  const drawLine = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
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

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    setPrevPos(getPos(e));
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
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

  const handleFillCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = currentColorHex;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleUploadClick = async () => {
    if (!canvasRef.current) return;
    setIsPosting(true);
    try {
      const imageBase64 = canvasRef.current.toDataURL('image/png');
      onDrawUpload(imageBase64, title.trim());
      setTitle('');
      handleClear();
    } finally {
      setIsPosting(false);
    }
  };

  const retroBoxStyle: React.CSSProperties = {
    backgroundColor: '#c4c8c4',
    borderTop: '2px solid #ffffff',
    borderLeft: '2px solid #ffffff',
    borderRight: '2px solid #505050',
    borderBottom: '2px solid #505050',
    fontSize: '11px',
    color: '#000000',
    userSelect: 'none',
  };

  const retroBtnStyle: React.CSSProperties = {
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
    <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginBottom: '24px' }}>
      <div style={{ ...retroBoxStyle, padding: '8px', width: '580px', maxWidth: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button onClick={handleUploadClick} disabled={isPosting} style={{ ...retroBtnStyle, padding: '4px 12px' }}>
              {isPosting ? '올리는 중...' : '올리기'}
            </button>
            <input
              type="text"
              placeholder="그림 제목 (선택)..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ padding: '2px 6px', fontSize: '11px', width: '130px', border: '1px solid #808080', background: '#fff', color: '#000' }}
            />
          </div>
          <div style={{ fontSize: '10px', backgroundColor: '#a8aca8', padding: '2px 6px', border: '1px solid #808080' }}>
            비툴 드로잉룸
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ border: '1px solid #000', backgroundColor: '#ffffff', width: '420px', height: '420px', maxWidth: '100%', cursor: 'crosshair', flex: 1 }}>
            <canvas
              ref={canvasRef}
              width={420}
              height={420}
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
              <button onClick={handleFillCanvas} style={{ ...retroBtnStyle, flex: 1, padding: '2px' }}>채우기</button>
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

            <div style={{ ...retroBoxStyle, padding: '4px', textAlign: 'center' }}>
              <div>작업 시간</div>
              <div style={{ marginTop: '2px', fontWeight: 'bold' }}>{formatTimer(seconds)}</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
          <button onClick={handleClear} style={{ ...retroBtnStyle, padding: '4px 12px' }}>클리어</button>
          <div style={{ ...retroBoxStyle, padding: '2px 6px', fontSize: '10px' }}>Retro Drawing Tool</div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 기존 RoadBlock 컴포넌트
// ==========================================
function RoadBlock({ item, comments, onComment, onEditComment, onDeleteComment, canComment, guestMode, editLevel, delLevel, canEditItem, canDeleteItem, onEdit, onDelete }: {
  item: RoadItem;
  comments: Comment[];
  onComment: (id: string, text: string, guest?: { name: string; pw: string }) => void;
  onEditComment: (id: string, cid: string, text: string) => void;
  onDeleteComment: (id: string, cid: string) => void;
  canComment: boolean;
  guestMode: boolean;
  editLevel: (c: Comment) => 'free' | 'pw' | null;
  delLevel: (c: Comment) => 'free' | 'pw' | null;
  canEditItem: boolean;
  canDeleteItem: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [gName, setGName] = useState('');
  const [gPw, setGPw] = useState('');
  const [editCid, setEditCid] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [pwAsk, setPwAsk] = useState<{ mode: 'edit' | 'del'; c: Comment } | null>(null);
  const [pwInput, setPwInput] = useState('');
  const del = useConfirmDelete();
  const folded = item.fold && !open;
  const imgSrc = useBlobUrl(item.imgId ?? item.imgUrl);
  
  const saveEdit = () => {
    if (editCid && editText.trim()) onEditComment(item.id, editCid, editText.trim());
    setEditCid(null);
  };
  const post = () => {
    if (!text.trim()) return;
    if (guestMode && (!gName.trim() || !gPw)) { toast('게스트는 닉네임과 비밀번호를 입력해 주세요'); return; }
    onComment(item.id, text.trim(), guestMode ? { name: gName.trim(), pw: gPw } : undefined);
    setText('');
  };
  const askManage = (c: Comment, mode: 'edit' | 'del') => {
    const level = mode === 'edit' ? editLevel(c) : delLevel(c);
    if (level === 'pw') { setPwInput(''); setPwAsk({ mode, c }); return; }
    if (level !== 'free') return;
    if (mode === 'edit') { setEditCid(c.id); setEditText(c.text); }
    else del.ask('이 댓글을 삭제하시겠습니까?', () => onDeleteComment(item.id, c.id));
  };
  const confirmPw = () => {
    if (!pwAsk) return;
    if (pwInput !== pwAsk.c.guestPw) { toast('비밀번호가 일치하지 않습니다'); return; }
    if (pwAsk.mode === 'edit') { setEditCid(pwAsk.c.id); setEditText(pwAsk.c.text); }
    else onDeleteComment(item.id, pwAsk.c.id);
    setPwAsk(null);
  };
  return (
    <div className="panel roadview-item">
      <div className="rv-head">
        <b>No.{String(item.no ?? 0).padStart(3, '0')}</b>
      </div>
      <div className={`art ${folded ? 'veil' : ''}`} style={{ background: 'var(--panel-solid)' }}>
        {imgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgSrc} alt={item.title}
            className={`artimg ${item.narrow ? 'narrow' : ''}`} style={{ filter: folded ? 'blur(18px)' : undefined }} />
        ) : (
          <div className={`artimg ${item.narrow ? 'narrow' : ''} ph ${item.ph}`}
            style={{ aspectRatio: item.ratio, filter: folded ? 'blur(18px)' : undefined }}>
            <span>{item.title}</span>
          </div>
        )}
        {folded && (
          <div className="cover" onClick={() => setOpen(true)}>
            <div>
              <b>{item.fold!.type === 'custom' ? (item.fold!.label || '접힘') : FOLD_LABEL[item.fold!.type]}</b><br />
              <span>클릭하여 표시</span>
            </div>
          </div>
        )}
        {(canEditItem || canDeleteItem) && (
          <div className="rv-actions" style={{ position: 'absolute', top: 12, right: 12, zIndex: 6, display: 'flex', gap: 6 }}>
            {canEditItem && (
              <button style={{ fontSize: 10.5, padding: '5px 11px', borderRadius: 999, background: 'rgba(15,17,20,.55)', color: '#dfe2e7' }}
                onClick={e => { e.stopPropagation(); onEdit(); }}>EDIT</button>
            )}
            {canDeleteItem && (
              <button style={{ fontSize: 10.5, padding: '5px 11px', borderRadius: 999, background: 'rgba(166,58,69,.75)', color: '#fff' }}
                onClick={e => { e.stopPropagation(); onDelete(); }}>DELETE</button>
            )}
          </div>
        )}
      </div>
      <div className="cmt-side">
        <div className="list">
          {comments.map(c => (
            <div className="cmt" key={c.id}>
              <b>{c.author}</b><small>{fmtDate(c.date)}</small>
              {editCid !== c.id && (
                <>
                  {editLevel(c) !== null && (
                    <small style={{ cursor: 'var(--cur-pointer,pointer)', color: 'var(--accent)', marginLeft: 8 }}
                      onClick={() => askManage(c, 'edit')}>수정</small>
                  )}
                  {delLevel(c) !== null && (
                    <small style={{ cursor: 'var(--cur-pointer,pointer)', marginLeft: 6 }}
                      onClick={() => askManage(c, 'del')}>삭제</small>
                  )}
                </>
              )}
              {editCid === c.id ? (
                <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
                  <KInput value={editText} autoFocus onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditCid(null); }}
                    style={{ flex: 1 }} />
                  <button className="btn btn-dark" style={{ padding: '4px 11px', fontSize: 10.5 }} onClick={saveEdit}>SAVE</button>
                  <button className="btn btn-ghost" style={{ padding: '4px 9px', fontSize: 10.5 }} onClick={() => setEditCid(null)}>✕</button>
                </div>
              ) : (
                <p>{c.text}</p>
              )}
            </div>
          ))}
          {comments.length === 0 && <p className="hint">첫 댓글을 남겨보세요</p>}
        </div>
        <div className={`cmt-input ${guestMode && canComment ? 'guest' : ''}`}>
          {guestMode && canComment && (
            <GuestIdBar name={gName} pw={gPw} onName={setGName} onPw={setGPw} />
          )}
          <div className="ci-row" style={guestMode && canComment ? undefined : { display: 'contents' }}>
            <KInput placeholder={canComment ? '댓글 남기기...' : '댓글은 로그인 후'} value={text}
              disabled={!canComment}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') post(); }} />
            <button className="btn btn-dark" disabled={!canComment} onClick={post}>POST</button>
          </div>
        </div>
      </div>
      {del.element}
      <Modal open={pwAsk !== null} onClose={() => setPwAsk(null)} small title={pwAsk?.mode === 'del' ? '댓글 삭제' : '댓글 수정'}
        actions={<>
          <button className="btn btn-ghost" onClick={() => setPwAsk(null)}>CANCEL</button>
          <button className="btn btn-dark" onClick={confirmPw}>OK</button>
        </>}>
        <KInput placeholder="작성 시 입력한 비밀번호" type="password" value={pwInput} autoFocus
          onChange={e => setPwInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') confirmPw(); }} />
      </Modal>
    </div>
  );
}

export default function RoadviewPage() {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const [menuSet] = useMenuSettings();
  const allow = (p: MenuPerm) => (p === 'admin' ? isAdmin : p === 'member' ? !!user : true);
  const [items, setItems, roadLoaded] = useLocalList<RoadItem>('ohome.road.v1', ROAD_SEED);
  const [cmtRows, setCmtRows] = useLocalList<CommentRow>(COMMENT_KEY, COMMENT_SEED);
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(PAGE_SIZE);

  useEffect(() => {
    if (!roadLoaded) return;
    if (items.some(it => it.no === undefined)) {
      let n = Math.max(0, ...items.map(it => it.no ?? 0));
      const next = [...items].sort((a, b) => a.date.localeCompare(b.date))
        .map(it => (it.no === undefined ? { ...it, no: ++n } : it));
      setItems(items.map(it => next.find(x => x.id === it.id) ?? it));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roadLoaded]);

  const nextNo = Math.max(0, ...items.map(it => it.no ?? 0)) + 1;
  const padNo = (n?: number) => `No.${String(n ?? 0).padStart(3, '0')}`;
  const fileRef = useRef<HTMLInputElement>(null);
  const [editFor, setEditFor] = useState<RoadItem | null>(null);
  const [eNo, setENo] = useState('');
  const [eAdult, setEAdult] = useState(false);
  const [delFor, setDelFor] = useState<RoadItem | null>(null);

  const upload = async (f: File | undefined) => {
    if (!f) return;
    const imgId = await putBlob(f);
    const it: RoadItem = {
      id: newId(), title: '', author: user?.nickname ?? '익명', authorId: user?.id ?? 'guest',
      date: new Date().toISOString(), imgId, ph: '', ratio: 'auto',
      fold: null, comments: [],
      no: nextNo,
    };
    setItems([it, ...items]);
    toast(`${padNo(it.no)} 업로드되었습니다`);
  };

  const handleDrawUpload = async (base64: string, customTitle: string) => {
    const res = await fetch(base64);
    const blob = await res.blob();
    const file = new File([blob], 'drawing.png', { type: 'image/png' });
    const imgId = await putBlob(file);

    const it: RoadItem = {
      id: newId(),
      title: customTitle,
      author: user?.nickname ?? '익명작가',
      authorId: user?.id ?? 'guest',
      date: new Date().toISOString(),
      imgId,
      ph: '',
      ratio: 'auto',
      fold: null,
      comments: [],
      no: nextNo,
    };

    setItems([it, ...items]);
    toast(`🎨 ${padNo(it.no)} 그림이 로드비에 등록되었습니다!`);
  };

  const addComment = (id: string, text: string, guest?: { name: string; pw: string }) => {
    const base = { id: newId(), text, date: new Date().toISOString(), target: 'road' as const, targetId: id };
    const c: CommentRow = guest
      ? { ...base, author: guest.name, authorId: '', guestPw: guest.pw }
      : { ...base, author: user?.nickname ?? '익명', authorId: user?.id ?? '' };
    setCmtRows([...cmtRows, c]);
    const target = items.find(it => it.id === id);
    if (target && target.authorId && target.authorId !== (user?.id ?? '')) {
      pushNotif({
        type: 'comment', toUserId: target.authorId, href: '/roadview',
        title: `${padNo(target.no)}에 새 댓글`,
        body: `${c.author} — ${text.slice(0, 50)}`,
      });
    }
  };

  const editComment = (id: string, cid: string, text: string) => {
    if (cmtRows.some(c => c.id === cid)) setCmtRows(cmtRows.map(c => (c.id === cid ? { ...c, text } : c)));
    else setItems(items.map(it => it.id === id ? { ...it, comments: it.comments.map(c => c.id === cid ? { ...c, text } : c) } : it));
  };
  const deleteComment = (id: string, cid: string) => {
    if (cmtRows.some(c => c.id === cid)) setCmtRows(cmtRows.filter(c => c.id !== cid));
    else setItems(items.map(it => it.id === id ? { ...it, comments: it.comments.filter(c => c.id !== cid) } : it));
  };
  const editLevel = (c: Comment): 'free' | 'pw' | null => {
    if (user && c.authorId === user.id) return 'free';
    return !c.authorId && c.guestPw ? 'pw' : null;
  };
  const delLevel = (c: Comment): 'free' | 'pw' | null => {
    if (isAdmin || (user && c.authorId === user.id)) return 'free';
    return !c.authorId && c.guestPw ? 'pw' : null;
  };

  const visible = items.filter(it => !q || it.author.includes(q)
    || padNo(it.no).includes(q) || String(it.no ?? '').includes(q));

  return (
    <section className="page">
      <div className="page-head">
        <PageTitle>LOAD-B</PageTitle>
        <EditableDesc k="roadview-desc" def="그림이 좋아서 모았습니다" />
        <div className="head-actions">
          {allow(menuSet.roadUpload) && !!user && (
            <>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { upload(e.target.files?.[0]); e.target.value = ''; }} />
              <button className="btn btn-dark" onClick={() => fileRef.current?.click()}
                {...fileDrop(fl => upload(fl[0]))}>↑ UPLOAD</button>
            </>
          )}
          <SearchBar onSearch={setQ} />
        </div>
      </div>

      {/* 🔥 조건 없이 무조건 최상단에 그림판 강제 노출 */}
      <RetroDrawingBoard onDrawUpload={handleDrawUpload} />

      {visible.slice(0, shown).map(it => (
        <RoadBlock key={it.id} item={it} comments={commentsFor(cmtRows, 'road', it.id, it.comments)} onComment={addComment}
          onEditComment={editComment} onDeleteComment={deleteComment}
          canComment={allow(menuSet.roadComment) && (!!user || menuSet.roadComment === 'guest')}
          guestMode={!user && menuSet.roadComment === 'guest'}
          editLevel={editLevel} delLevel={delLevel}
          canEditItem={it.authorId === user?.id}
          canDeleteItem={isAdmin || it.authorId === user?.id}
          onEdit={() => { setEditFor(it); setENo(String(it.no ?? '')); setEAdult(it.fold?.type === 'adult'); }}
          onDelete={() => setDelFor(it)} />
      ))}
      {visible.length === 0 && (
        <div className="panel" style={{ textAlign: 'center', padding: 44, fontSize: 13, color: 'var(--faint)' }}>
          그림이 없습니다
        </div>
      )}
      {shown < visible.length && (
        <div style={{ textAlign: 'center', marginTop: 6 }}>
          <button className="btn btn-ghost" style={{ background: 'rgba(255,255,255,.9)' }}
            onClick={() => setShown(s => s + PAGE_SIZE)}>MORE ↓</button>
        </div>
      )}
      <Modal open={editFor !== null} onClose={() => setEditFor(null)} small title="그림 편집"
        actions={<>
          <button className="btn btn-ghost" onClick={() => setEditFor(null)}>CANCEL</button>
          <button className="btn btn-dark" onClick={() => {
            const nv = parseInt(eNo, 10);
            setItems(items.map(x => x.id === editFor!.id
              ? { ...x, no: Number.isFinite(nv) && nv > 0 ? nv : x.no, fold: eAdult ? { type: 'adult' } : null } : x));
            setEditFor(null);
          }}>SAVE</button>
        </>}>
        <div style={{ display: 'grid', gap: 9 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="cp-lb">번호</span>
            <KInput value={eNo} onChange={e => setENo(e.target.value.replace(/[^\d]/g, ''))}
              style={{ width: 90, textAlign: 'center' }} />
          </div>
          <KCheck label="수위 주의 접기 (블러 + 클릭 표시)" checked={eAdult} onChange={setEAdult} />
        </div>
      </Modal>

      <ConfirmModal open={delFor !== null} title="그림을 삭제하시겠습니까?"
        body={`${padNo(delFor?.no)} — 삭제한 그림과 댓글은 복구할 수 없습니다.`}
        onClose={() => setDelFor(null)}
        buttons={[
          { label: 'DELETE', kind: 'accent', onClick: () => {
            const gone = delFor!.id;
            setItems(items.filter(x => x.id !== gone));
            setCmtRows(cmtRows.filter(c => !(c.target === 'road' && c.targetId === gone)));
            setDelFor(null);
          } },
          { label: 'CANCEL', kind: 'ghost', onClick: () => setDelFor(null) },
        ]} />
    </section>
  );
}
