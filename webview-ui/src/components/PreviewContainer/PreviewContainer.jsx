export function PreviewContainer({ previewSrc, onIframeLoad }) {
  return (
    <main className="preview-container">
      {previewSrc ? (
        <iframe
          id="previewFrame"
          src={previewSrc}
          title="Web Inspector Preview"
          className="preview-iframe"
          onLoad={onIframeLoad}
        />
      ) : (
        <div className="empty-state">
          <div className="empty-icon">🌐</div>
          <h3>Ready to Inspect</h3>
          <p>Enter a target URL above and press Enter to start inspecting elements.</p>
        </div>
      )}
    </main>
  );
}
