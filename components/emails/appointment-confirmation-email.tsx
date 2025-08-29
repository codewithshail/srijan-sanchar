import * as React from 'react';

interface AppointmentConfirmationEmailProps {
  userName: string;
  appointmentTime: Date;
  meetLink: string;
}

const containerStyle: React.CSSProperties = {
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
  padding: '20px',
  backgroundColor: '#f4f4f7',
  color: '#333',
};

const cardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e2e2',
  borderRadius: '8px',
  padding: '30px',
  maxWidth: '600px',
  margin: '0 auto',
};

const headingStyle: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#000',
  marginBottom: '20px',
};

const textStyle: React.CSSProperties = {
  fontSize: '16px',
  lineHeight: '1.5',
  marginBottom: '15px',
};

const detailsStyle: React.CSSProperties = {
  backgroundColor: '#f9f9f9',
  border: '1px solid #eaeaea',
  borderRadius: '4px',
  padding: '15px',
  marginBottom: '20px',
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: '#007bff',
  color: '#ffffff',
  padding: '12px 20px',
  borderRadius: '5px',
  textDecoration: 'none',
  fontSize: '16px',
  display: 'inline-block',
};

export const AppointmentConfirmationEmail: React.FC<AppointmentConfirmationEmailProps> = ({
  userName,
  appointmentTime,
  meetLink,
}) => {
  const formattedTime = appointmentTime.toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={headingStyle}>Your Session is Confirmed!</h1>
        <p style={textStyle}>Hello {userName},</p>
        <p style={textStyle}>
          We are pleased to confirm your session with one of our experts. This is an important step in your journey of rewriting your story, and we are here to support you.
        </p>
        <div style={detailsStyle}>
          <p style={textStyle}>
            <strong>Time:</strong> {formattedTime}
          </p>
          <p style={textStyle}>
            <strong>Where:</strong> Google Meet (link below)
          </p>
        </div>
        <p style={textStyle}>Please click the button below to join the session at the scheduled time.</p>
        <a href={meetLink} style={buttonStyle} target="_blank" rel="noopener noreferrer">
          Join Google Meet
        </a>
        <p style={{ ...textStyle, marginTop: '20px', fontSize: '14px', color: '#666' }}>
          If you have any questions or need to reschedule, please contact our support.
        </p>
      </div>
    </div>
  );
};

export default AppointmentConfirmationEmail;