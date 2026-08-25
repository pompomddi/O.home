import React, { useRef } from 'react';
import { ReactSketchCanvas } from 'react-sketch-canvas';

export default function DrawingBoard() {
  const canvasRef = useRef(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '20px 0' }}>
      <ReactSketchCanvas
        ref={canvasRef}
        strokeWidth={3}
        strokeColor="#000000"
        canvasColor="#ffffff"
        style={{ border: '2px solid #ccc', borderRadius: '8px', width: '100%', maxWidth: '600px', height: '450px' }}
      />
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={() => canvasRef.current.clearCanvas()} style={{ padding: '6px 12px', cursor: 'pointer' }}>
          싹 지우기
        </button>
        <button onClick={() => canvasRef.current.undo()} style={{ padding: '6px 12px', cursor: 'pointer' }}>
          되돌리기
        </button>
      </div>
    </div>
  );
}
