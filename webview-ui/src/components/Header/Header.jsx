import { Input, Button } from '@fluentui/react-components';
import { CursorClick20Regular, CursorClick20Filled, Search16Regular } from '@fluentui/react-icons';

export function Header({ url, setUrl, onKeyPress, isInspectActive, toggleInspect }) {
  return (
    <header className="glass-header" style={{ justifyContent: 'flex-start' }}>
      <div className="input-group" style={{ display: 'flex', alignItems: 'center', width: '100%', maxWidth: '360px', gap: '8px' }}>
        <Input
          value={url}
          onChange={(e, data) => setUrl(data.value)}
          onKeyDown={onKeyPress}
          placeholder="Enter site (e.g. https://chatgpt.com)"
          className="url-input"
          appearance="filled-darker"
          size="small"
          contentBefore={<Search16Regular />}
          style={{ flex: 1, borderRadius: '4px' }}
        />
        <Button
          appearance={isInspectActive ? "primary" : "subtle"}
          onClick={toggleInspect}
          icon={isInspectActive ? <CursorClick20Filled /> : <CursorClick20Regular />}
          title="Toggle Inspect Element Mode (Alt+Shift+I)"
          size="small"
          style={{ borderRadius: '4px', minWidth: '32px', padding: '0 4px' }}
        />
      </div>
    </header>
  );
}
