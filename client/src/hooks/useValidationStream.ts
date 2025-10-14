import { useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

interface ValidationStreamData {
  type: 'connected' | 'progress' | 'completed' | 'error';
  status?: string;
  progress?: number;
  jobState?: string;
  message?: string;
}

/**
 * useValidationStream Hook
 *
 * Establishes a Server-Sent Events (SSE) connection to receive real-time
 * validation progress updates from the backend.
 *
 * Features:
 * - Automatic connection management
 * - Auth0 token-based authentication
 * - Auto-close on completion/error
 * - Connection status tracking
 * - Error handling and logging
 *
 * @param validationId - The validation run ID to stream
 * @param enabled - Whether to enable the stream (default: true)
 * @returns Object containing stream data and connection status
 */
export function useValidationStream(validationId: string, enabled: boolean = true) {
  const [data, setData] = useState<ValidationStreamData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    if (!enabled || !validationId) return;

    let eventSource: EventSource | null = null;

    const connect = async () => {
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: import.meta.env.VITE_AUTH0_AUDIENCE || "facnet-validator-api",
            scope: "openid profile email offline_access"
          }
        });

        const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
        const url = `${baseUrl}/validations/${validationId}/stream`;

        // EventSource doesn't support custom headers, so pass token in URL
        eventSource = new EventSource(`${url}?token=${token}`);

        eventSource.onopen = () => {
          setIsConnected(true);
          console.log('[SSE] Connected to validation stream');
        };

        eventSource.onmessage = (event) => {
          try {
            const parsedData = JSON.parse(event.data);
            setData(parsedData);

            console.log('[SSE] Received data:', parsedData);

            // Close connection when completed/failed
            if (parsedData.type === 'completed' || parsedData.type === 'error') {
              console.log('[SSE] Validation finished, closing connection');
              eventSource?.close();
              setIsConnected(false);
            }
          } catch (error) {
            console.error('[SSE] Failed to parse message:', error);
          }
        };

        eventSource.onerror = (error) => {
          console.error('[SSE] Connection error:', error);
          setIsConnected(false);
          eventSource?.close();
        };
      } catch (error) {
        console.error('[SSE] Failed to connect:', error);
        setIsConnected(false);
      }
    };

    connect();

    return () => {
      if (eventSource) {
        console.log('[SSE] Cleaning up connection');
        eventSource.close();
        setIsConnected(false);
      }
    };
  }, [validationId, enabled, getAccessTokenSilently]);

  return { data, isConnected };
}
