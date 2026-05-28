import { FluentProvider, webDarkTheme } from '@fluentui/react-components';
import { Header, PreviewContainer } from './components';
import { usePreview } from './hooks/usePreview';
import './App.css';

function App() {
  const { url, setUrl, previewSrc, loadUrl, isInspectActive, toggleInspect, syncInspectState } = usePreview();

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      loadUrl();
    }
  };

  return (
    <FluentProvider theme={webDarkTheme} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="app-container">
        <Header
          url={url}
          setUrl={setUrl}
          onKeyPress={handleKeyPress}
          isInspectActive={isInspectActive}
          toggleInspect={toggleInspect}
        />
        <PreviewContainer previewSrc={previewSrc} onIframeLoad={syncInspectState} />
      </div>
    </FluentProvider>
  );
}

export default App;
