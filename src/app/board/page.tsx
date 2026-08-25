'use client';

import React, { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import {
  useLocalList, BOARD_SEED, Post, fmtDate,
  CommentRow, COMMENT_KEY, COMMENT_SEED, commentsFor,
} from '@/lib/postStore';
import {
  useBoardSettings, useBoards, badgeFor, boardBadgeStyle, boardHref, MAIN_BOARD_ID, BoardPerm,
} from '@/lib/boardStore';
import { SearchBar, Pager } from '@/components/ui/Kit';
import { CropImg } from '@/components/ui/CropEditor';
import { EditableDesc, PageTitle } from '@/components/ui/PageText';
import DrawingBoard from '@/components/DrawingBoard';

const PER_PAGE = 10;

function firstImage(body: string): string | null {
  const html = /<img[^>]*src=["']([^"']+)["']/i.exec(body);
  if (html) return html[1];
  const md = /!\[[^\]]*\]\(([^)\s]+)/.exec(body);
  return md ? md[1] : null;
}

function BoardInner() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const params = useSearchParams();
  const bid = params.get('b') ?? MAIN_BOARD_ID;
  const { boards, loaded: boardsLoaded } = useBoards();
  const board = boards.find(b => b.id === bid) ?? boards[0];

  const [posts, setPosts] = useLocalList<Post>('ohome.board.v1', BOARD_SEED);
  const [cmtRows] = useLocalList<CommentRow>(COMMENT_KEY, COMMENT_SEED);

  const cmtCount = (p: Post) => commentsFor(cmtRows || [], 'post', p.id, p.comments).length;
  const { st: boardSet } = useBoardSettings();
  const [cat, setCat] = useState('전체');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const [prevBid, setPrevBid] = useState(bid);
  if (prevBid !== bid) { 
    setPrevBid(bid); 
    setCat('전체'); 
    setQ(''); 
    setPage(1); 
  }

  const allow = (p: BoardPerm) => (p === 'admin' ? isAdmin : p === 'member' ? !!user : true);

  const currentPosts = Array.isArray(posts) ? posts : [];

  const visible = useMemo(() => {
    let list = currentPosts.filter(p => (p.boardId ?? MAIN_BOARD_ID) === board.id);
    if (cat === '공지') list = list.filter(p => p.notice);
    else if (cat !== '전체') list = list.filter(p => p.category === cat);
    if (q) {
      const k = q.toLowerCase();
      list = list.filter(p =>
        p.title.toLowerCase().includes(k) ||
        p.author.toLowerCase().includes(k) ||
        (!p.secret && p.body.toLowerCase().includes(k)));
    }
    return list.sort((a, b) =>
      (b.notice ? 1 : 0) - (a.notice ? 1 : 0) || b.date.localeCompare(a.date));
  }, [currentPosts, board.id, cat, q]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PER_PAGE));
  const pageList = visible.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const canRead = (p: Post) => !p.secret || isAdmin || p.authorId === user?.id;

  const handlePostSuccess = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  if (!boardsLoaded) return <section className="page" />;

  const postBadge = (p: Post) => (
    <span style={boardBadgeStyle(badgeFor(boardSet, p, board.cats))}>
      {p.notice ? boardSet.system[0].label : p.secret ? boardSet.system[1].label : p.category}
    </span>
  );

  return (
    <section className="page">
      <div className="page-head">
        <PageTitle href={boardHref(board.id)}>{board.id === MAIN_BOARD_ID ? 'BOARD' : board.name}</PageTitle>
        <EditableDesc k={board.id === MAIN_BOARD_ID ? 'board-desc' : `board-desc-${board.id}`} def={board.desc} />
      </div>

      {/* load-b 게시판 접속 시 고정 표시 */}
      {board.id === 'load-b' && (
        <div className="panel" style={{ padding: '16px', marginBottom: '20px' }}>
          <DrawingBoard boardId="load-b" onPostSuccess={handlePostSuccess} />
        </div>
      )}

      <div className="toolrow">
        <div className="seg">
          {['전체', '공지', ...board.cats.map(x => x.label)].map(c => (
            <button key={c} className={cat === c ? 'on' : ''} onClick={() => { setCat(c); setPage(1); }}>{c}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <SearchBar onSearch={v => { setQ(v); setPage(1); }} />
          {allow(board.permWrite) && !!user && (
            <button className="btn btn-dark" onClick={() => router.push(`/board/write?b=${board.id}`)}>✎ WRITE</button>
          )}
        </div>
      </div>

      {board.skin === 'ticket' ? (
        <div style={board.fg ? { color: board.fg } : undefined}>
          {pageList.map(p => {
            const thumb = canRead(p) ? (p.thumbSrc ?? firstImage(p.body)) : null;
            return (
              <div className="bticket" key={p.id} onClick={() => { if (canRead(p)) router.push(`/board/${p.id}`); }}>
                <div className="bt-thumb">
                  {thumb
                    ? <CropImg src={thumb} crop={p.thumbSrc ? p.thumbCrop : undefined} />
                    : <div className="bt-ph">{(canRead(p) ? p.title : 'SECRET').slice(0, 1).toUpperCase()}</div>}
                </div>
                <div className="bt-body">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {postBadge(p)}
                    {p.fold && <span style={boardBadgeStyle(boardSet.system[2])}>{boardSet.system[2].label}</span>}
                  </div>
                  <div className="bt-title">
                    {canRead(p) ? <>{p.secret && '🔒 '}{p.title}</> : '🔒 비밀글입니다'}
                    {canRead(p) && cmtCount(p) > 0 && <span className="cmt">{cmtCount(p)}</span>}
                  </div>
                  <div className="bt-meta">{p.author} · {fmtDate(p.date)}</div>
                </div>
              </div>
            );
          })}
          {pageList.length === 0 && (
            <div className="panel" style={{ padding: 36, textAlign: 'center', fontSize: 12.5, color: 'var(--faint)' }}>게시글이 없습니다</div>
          )}
        </div>
      ) : (
        <div className="panel board-list flush" style={board.fg ? { color: board.fg } : undefined}>
          {pageList.map(p => (
            <div className="brow" key={p.id} onClick={() => { if (canRead(p)) router.push(`/board/${p.id}`); }}>
              <span className="cat">{postBadge(p)}</span>
              {canRead(p) ? (
                <b>
                  {p.secret && '🔒 '}{p.title}
                  {cmtCount(p) > 0 && <span className="cmt">{cmtCount(p)}</span>}
                  {p.fold && <span style={{ ...boardBadgeStyle(boardSet.system[2]), marginLeft: 6 }}>{boardSet.system[2].label}</span>}
                </b>
              ) : (
                <b style={{ color: 'var(--faint)' }}>🔒 비밀글입니다</b>
              )}
              <span className="who">{p.author}</span>
              <span className="dt">{fmtDate(p.date)}</span>
            </div>
          ))}
          {pageList.length === 0 && (
            <div style={{ padding: 36, textAlign: 'center', fontSize: 12.5, color: 'var(--faint)' }}>게시글이 없습니다</div>
          )}
        </div>
      )}

      <Pager page={page} total={totalPages} onChange={setPage} />
    </section>
  );
}

export default function BoardPage() {
  return <Suspense fallback={<section className="page" />}><BoardInner /></Suspense>;
}
