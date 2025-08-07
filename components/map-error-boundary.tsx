import React from 'react';
import { Box, Typography, Button } from '@mui/material';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface Props {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
}

export class MapErrorBoundary extends React.Component<Props, ErrorBoundaryState> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 Map Error Boundary caught an error:', error);
    console.error('🚨 Error Info:', errorInfo);
    
    // Log specific deck.gl errors
    if (error.message?.includes('deck.gl') || error.message?.includes('assertion failed')) {
      console.error('🚨 Deck.gl specific error detected');
      console.error('🚨 Stack trace:', error.stack);
    }
    
    this.setState({
      hasError: true,
      error,
      errorInfo,
    });
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined as unknown as Error, errorInfo: undefined as unknown as React.ErrorInfo });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error!} retry={this.retry} />;
      }

      return (
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'background.default',
            p: 3,
          }}
        >
          <Typography variant="h5" color="error" gutterBottom>
            Map Rendering Error
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
            {this.state.error?.message?.includes('deck.gl') 
              ? 'There was an issue with the map visualization engine. This might be due to invalid coordinate data.'
              : 'Something went wrong while rendering the map.'
            }
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontFamily: 'monospace' }}>
            Error: {this.state.error?.message}
          </Typography>
          <Button variant="contained" onClick={this.retry}>
            Retry
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}
