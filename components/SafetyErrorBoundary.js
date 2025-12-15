
import React from 'react';
import { resetSafetyCounter } from '../utils/firestore-guard';

class SafetyErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  handleReset = () => {
    resetSafetyCounter();
    this.setState({ hasError: false, error: null });
    window.location.reload(); 
  };

  render() {
    if (this.state.hasError) {
      const isSafetyError = this.state.error?.message?.includes('SAFETY STOP');

      if (isSafetyError) {
        return (
          <div style={{
            padding: '2rem', 
            backgroundColor: '#fee2e2', 
            border: '2px solid #ef4444',
            borderRadius: '8px',
            margin: '2rem',
            textAlign: 'center',
            fontFamily: 'system-ui, sans-serif'
          }}>
            <h1 style={{color: '#b91c1c'}}>🔥 FIRESTORE SAFETY LOCK ENGAGED</h1>
            <p style={{fontSize: '1.2rem', color: '#7f1d1d'}}>
              An infinite loop or massive read spike was detected (200+ reads/minute).
              <br/>
              <strong>Execution has been blocked to save your quota.</strong>
            </p>
            <button 
              onClick={this.handleReset}
              style={{
                marginTop: '1rem',
                padding: '10px 20px',
                fontSize: '1rem',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Reset Counter & Reload
            </button>
          </div>
        );
      }
    }

    return this.props.children;
  }
}

export default SafetyErrorBoundary;
