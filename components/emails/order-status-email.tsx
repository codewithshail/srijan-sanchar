import * as React from 'react';

interface OrderStatusEmailProps {
  userName: string;
  orderId: string;
  storyTitle: string;
  status: 'processing' | 'shipped' | 'delivered' | 'cancelled';
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedDelivery?: string;
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
  backgroundColor: '#6366f1',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontSize: '16px',
  display: 'inline-block',
  fontWeight: '500',
};

const statusBadgeStyle = (status: string): React.CSSProperties => {
  const colors: Record<string, { bg: string; text: string }> = {
    processing: { bg: '#fef3c7', text: '#92400e' },
    shipped: { bg: '#dbeafe', text: '#1e40af' },
    delivered: { bg: '#d1fae5', text: '#065f46' },
    cancelled: { bg: '#fee2e2', text: '#991b1b' },
  };
  const color = colors[status] || colors.processing;
  
  return {
    display: 'inline-block',
    padding: '6px 12px',
    borderRadius: '4px',
    backgroundColor: color.bg,
    color: color.text,
    fontWeight: '600',
    fontSize: '14px',
    textTransform: 'capitalize' as const,
  };
};

const footerStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#666',
  marginTop: '20px',
  textAlign: 'center' as const,
};

const getStatusMessage = (status: string): { emoji: string; title: string; message: string } => {
  switch (status) {
    case 'processing':
      return {
        emoji: '📦',
        title: 'Your Order is Being Prepared',
        message: 'Great news! Your book is now being printed and prepared for shipping. We\'ll notify you once it\'s on its way.',
      };
    case 'shipped':
      return {
        emoji: '🚚',
        title: 'Your Order Has Shipped!',
        message: 'Your book is on its way! You can track your package using the tracking information below.',
      };
    case 'delivered':
      return {
        emoji: '🎉',
        title: 'Your Order Has Been Delivered!',
        message: 'Your book has been delivered. We hope you enjoy your printed story! If you have any issues, please contact us.',
      };
    case 'cancelled':
      return {
        emoji: '❌',
        title: 'Order Cancelled',
        message: 'Your order has been cancelled. If you didn\'t request this cancellation or have any questions, please contact our support team.',
      };
    default:
      return {
        emoji: '📋',
        title: 'Order Update',
        message: 'There\'s an update to your order.',
      };
  }
};

export const OrderStatusEmail: React.FC<OrderStatusEmailProps> = ({
  userName,
  orderId,
  storyTitle,
  status,
  trackingNumber,
  trackingUrl,
  estimatedDelivery,
}) => {
  const statusInfo = getStatusMessage(status);

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={headingStyle}>{statusInfo.emoji} {statusInfo.title}</h1>
        
        <p style={textStyle}>Hello {userName},</p>
        
        <p style={textStyle}>{statusInfo.message}</p>

        <div style={detailsStyle}>
          <div style={{ marginBottom: '12px' }}>
            <span style={{ color: '#666', fontSize: '14px' }}>Order ID: </span>
            <span style={{ fontWeight: '500' }}>{orderId}</span>
          </div>
          
          <div style={{ marginBottom: '12px' }}>
            <span style={{ color: '#666', fontSize: '14px' }}>Story: </span>
            <span style={{ fontWeight: '500' }}>{storyTitle}</span>
          </div>
          
          <div>
            <span style={{ color: '#666', fontSize: '14px' }}>Status: </span>
            <span style={statusBadgeStyle(status)}>{status}</span>
          </div>
        </div>

        {status === 'shipped' && trackingNumber && (
          <div style={detailsStyle}>
            <div style={{ marginBottom: '12px' }}>
              <span style={{ color: '#666', fontSize: '14px' }}>Tracking Number: </span>
              <span style={{ fontFamily: 'monospace', fontWeight: '500' }}>{trackingNumber}</span>
            </div>
            
            {estimatedDelivery && (
              <div style={{ marginBottom: '12px' }}>
                <span style={{ color: '#666', fontSize: '14px' }}>Estimated Delivery: </span>
                <span style={{ fontWeight: '500' }}>{estimatedDelivery}</span>
              </div>
            )}
            
            {trackingUrl && (
              <div style={{ marginTop: '16px' }}>
                <a href={trackingUrl} style={buttonStyle} target="_blank" rel="noopener noreferrer">
                  Track Your Package
                </a>
              </div>
            )}
          </div>
        )}

        <p style={footerStyle}>
          Questions? Contact us at support@storyweave.app
          <br />
          Thank you for choosing StoryWeave!
        </p>
      </div>
    </div>
  );
};

export default OrderStatusEmail;
