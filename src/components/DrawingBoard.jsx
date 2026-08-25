import React, { useRef, useState } from 'react';
import { ReactSketchCanvas } from 'react-sketch-canvas';

export default function DrawingBoard() {
  const canvasRef = useRef(null);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2); // 도트느낌을 위해 기본값 2px
  const [isEraser, setIsEraser] = useState(false);

  // 고전 비툴/윈도우 그림판 기본 팔레트
  const palette = [
    '#000000', '#7f7f7f', '#880015', '#ed1c24', '#ff79e0', '#ffc90e', '#fff200', '#22b14c', '#00a2e8', '#3f48cc', '#a349a4',
    '#ffffff', '#c3c3c3', '#b5e61d', '#99d9ea', '#7092be', '#c8bfe7', '#ffaec9', '#ffc899', '#f5e49e', '#b5e61d', '#d3d3d3'
  ];

  const toggleEraser = () => {
    setIsEraser(!isEraser);
    canvasRef.current.eraseMode(!isEraser);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px',
      padding: '16px',
      width: '100%',
      maxWidth: '900px', // 넓고 큼직한 캔버스 틀
      margin: '0 auto',
      backgroundColor: '#c0c0c0', // 고전 그림판 회색 배경
      border: '2px solid #ffffff',
      boxShadow: 'inset -1px -1px #000, inset 1px 1px #fff'
    }}>
      {/* 그림판 툴바 상단 */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        backgroundColor: '#e0e0e0',
        padding: '10px 14px',
        border: '1px solid #808080'
      }}>
        
        {/* 펜 / 지우개 / 모드 선택 */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => { if (isEraser) toggleEraser(); }}
            style={{
              padding: '6px 12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              backgroundColor: !isEraser ? '#ffffff' : '#d0d0d0',
              border: '2px solid #808080',
              fontSize: '13px'
            }}
          >
            ✏️ 연필 (도트)
          </button>
          <button
            onClick={toggleEraser}
            style={{
              padding: '6px 12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              backgroundColor: isEraser ? '#ffaaaa' : '#ffffff',
              border: '2px solid #808080',
              fontSize: '13px'
            }}
          >
            🧹 지우개
          </button>
        </div>

        {/* 펜 굵기 조절 (1px, 2px 도트 연필 가능) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 'bold' }}>
          <span>굵기: {strokeWidth}px</span>
          <input
            type="range"
            min="1"
            max="40"
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            style={{ cursor: 'pointer', width: '100px' }}
          />
        </div>

        {/* 현재 색상 표시 및 커스텀 컬러 피커 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 'bold' }}>현재 색:</span>
          <input
            type="color"
            value={strokeColor}
            onChange={(e) => {
              setStrokeColor(e.target.value);
              if (isEraser) toggleEraser();
            }}
            style={{ width: '32px', height: '32px', border: '1px solid #000', cursor: 'pointer', padding: 0 }}
          />
        </div>

        {/* 되돌리기 / 전체 지우기 */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => canvasRef.current.undo()}
            style={{ padding: '6px 10px', fontSize: '12px', cursor: 'pointer', backgroundColor: '#fff', border: '1px solid #808080' }}
          >
            ↩️ 되돌리기
          </button>
          <button
            onClick={() => canvasRef.current.clearCanvas()}
            style={{ padding: '6px 10px', fontSize: '12px', cursor: 'pointer', backgroundColor: '#fff', border: '1px solid #808080' }}
          >
            💥 전체지우기
          </button>
        </div>
      </div>

      {/* 팔레트 색상 표 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', width: '100%', justifyContent: 'center', background: '#d0d0d0', padding: '6px', border: '1px solid #808080' }}>
        {palette.map((color, idx) => (
          <button
            key={idx}
            onClick={() => {
              setStrokeColor(color);
              if (isEraser) toggleEraser();
            }}
            style={{
              width: '24px',
              height: '24px',
              backgroundColor: color,
              border: strokeColor === color && !isEraser ? '2px solid #000' : '1px solid #808080',
              cursor: 'pointer',
              boxShadow: strokeColor === color ? '0 0 2px #000' : 'none'
            }}
          />
        ))}
      </div>

      {/* 큼직한 캔버스 영역 (800x550 크기) */}
      <div style={{ width: '100%', height: '550px', backgroundColor: '#ffffff', border: '2px solid #000' }}>
        <ReactSketchCanvas
          ref={canvasRef}
          strokeWidth={strokeWidth}
          strokeColor={strokeColor}
          canvasColor="#ffffff"
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      </div>
    </div>
  );
}
