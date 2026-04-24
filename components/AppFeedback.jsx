import React, { useEffect, useMemo, useState } from 'react';

const SUCCESS_PATTERNS = [
    'saved',
    'success',
    'successfully',
    'updated',
    'added',
    'approved',
    'notified',
    'restored',
    'enabled'
];

const ERROR_PATTERNS = [
    'error',
    'failed',
    'could not',
    'problem',
    'unavailable',
    'invalid',
    'missing',
    'restricted'
];

const WARNING_PATTERNS = [
    'warning',
    'expired',
    'overdue',
    'incomplete',
    'disabled'
];

function getTone(message) {
    const normalized = String(message || '').toLowerCase();

    if (ERROR_PATTERNS.some((pattern) => normalized.includes(pattern))) {
        return 'error';
    }

    if (WARNING_PATTERNS.some((pattern) => normalized.includes(pattern))) {
        return 'warning';
    }

    if (SUCCESS_PATTERNS.some((pattern) => normalized.includes(pattern))) {
        return 'success';
    }

    return 'info';
}

function getTitle(tone) {
    if (tone === 'success') return 'Success';
    if (tone === 'error') return 'Something went wrong';
    if (tone === 'warning') return 'Heads up';
    return 'Notice';
}

function getIcon(tone) {
    if (tone === 'success') return '✓';
    if (tone === 'error') return '!';
    if (tone === 'warning') return '!';
    return 'i';
}

export default function AppFeedback() {
    const [notices, setNotices] = useState([]);
    const [confirmState, setConfirmState] = useState(null);

    useEffect(() => {
        const originalAlert = window.alert.bind(window);
        const originalConfirm = window.confirm.bind(window);

        const pushNotice = (message) => {
            const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const tone = getTone(message);
            const duration = tone === 'error' ? 6500 : 4200;

            setNotices((current) => [...current, { id, message: String(message), tone }]);

            window.setTimeout(() => {
                setNotices((current) => current.filter((notice) => notice.id !== id));
            }, duration);
        };

        const askConfirm = (options) => {
            return new Promise((resolve) => {
                const normalized = typeof options === 'string'
                    ? { title: 'Confirm Action', message: options }
                    : {
                        title: options?.title || 'Confirm Action',
                        message: options?.message || '',
                        confirmLabel: options?.confirmLabel || 'Confirm',
                        cancelLabel: options?.cancelLabel || 'Cancel',
                        tone: options?.tone || 'danger'
                    };

                setConfirmState({
                    ...normalized,
                    resolve
                });
            });
        };

        window.alert = (message) => {
            pushNotice(message);
        };

        window.confirm = (message) => {
            askConfirm({ message }).then((result) => result);
            return false;
        };

        window.__vulahubNotify = pushNotice;
        window.__vulahubConfirm = askConfirm;

        return () => {
            window.alert = originalAlert;
            window.confirm = originalConfirm;
            delete window.__vulahubNotify;
            delete window.__vulahubConfirm;
        };
    }, []);

    const renderedNotices = useMemo(() => notices.slice(-4), [notices]);

    return (
        <>
            <div className="app-feedback-stack" aria-live="polite" aria-atomic="false">
                {renderedNotices.map((notice) => (
                    <div key={notice.id} className={`app-feedback app-feedback-${notice.tone}`} role="status">
                        <div className="app-feedback-icon">{getIcon(notice.tone)}</div>
                        <div className="app-feedback-copy">
                            <div className="app-feedback-title">{getTitle(notice.tone)}</div>
                            <div className="app-feedback-message">{notice.message}</div>
                        </div>
                        <button
                            type="button"
                            className="app-feedback-close"
                            aria-label="Dismiss message"
                            onClick={() => setNotices((current) => current.filter((item) => item.id !== notice.id))}
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>

            {confirmState && (
                <div className="app-confirm-overlay">
                    <div className={`app-confirm-card app-confirm-${confirmState.tone}`}>
                        <div className="app-confirm-badge">{confirmState.tone === 'danger' ? '!' : '?'}</div>
                        <div className="app-confirm-title">{confirmState.title}</div>
                        <div className="app-confirm-message">{confirmState.message}</div>
                        <div className="app-confirm-actions">
                            <button
                                type="button"
                                className="app-confirm-btn app-confirm-cancel"
                                onClick={() => {
                                    confirmState.resolve(false);
                                    setConfirmState(null);
                                }}
                            >
                                {confirmState.cancelLabel}
                            </button>
                            <button
                                type="button"
                                className={`app-confirm-btn app-confirm-confirm app-confirm-confirm-${confirmState.tone}`}
                                onClick={() => {
                                    confirmState.resolve(true);
                                    setConfirmState(null);
                                }}
                            >
                                {confirmState.confirmLabel}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
