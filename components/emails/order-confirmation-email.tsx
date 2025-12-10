import * as React from 'react';

interface ShippingAddress {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
}

interface OrderConfirmationEmailProps {
  userName: string;
  orderId: string;
  storyTitle: string;
  bookSize: string;
  coverType: string;
  quantity: number;
  totalAmount: number;
  shippingAddress: ShippingAddress;
  orderDate: Date;
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

const labelStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#666',
  marginBottom: '4px',
};

const valueStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: '500',
  color: '#000',
  marginBottom: '12px',
};

const dividerStyle: React.CSSProperties = {
  borderTop: '1px solid #eaeaea',
  margin: '20px 0',
};

const totalStyle: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 'bold',
  color: '#6366f1',
};

const footerStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#666',
  marginTop: '20px',
  textAlign: 'center' as const,
};

export const OrderConfirmationEmail: React.FC<OrderConfirmationEmailProps> = ({
  userName,
  orderId,
  storyTitle,
  bookSize,
  coverType,
  quantity,
  totalAmount,
  shippingAddress,
  orderDate,
}) => {
  const formattedDate = orderDate.toLocaleDateString('en-IN', {
    dateStyle: 'long',
  });

  const formattedAmount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(totalAmount / 100);

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={headingStyle}>🎉 Order Confirmed!</h1>
        
        <p style={textStyle}>Hello {userName},</p>
        
        <p style={textStyle}>
          Thank you for your order! We're excited to print your story and deliver it to you.
          Your book will be carefully crafted and shipped within 5-7 business days.
        </p>

        <div style={detailsStyle}>
          <div style={labelStyle}>Order ID</div>
          <div style={valueStyle}>{orderId}</div>
          
          <div style={labelStyle}>Order Date</div>
          <div style={valueStyle}>{formattedDate}</div>
        </div>

        <h2 style={{ ...headingStyle, fontSize: '18px' }}>Book Details</h2>
        
        <div style={detailsStyle}>
          <div style={labelStyle}>Story Title</div>
          <div style={valueStyle}>{storyTitle}</div>
          
          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Book Size</div>
              <div style={valueStyle}>{bookSize}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Cover Type</div>
              <div style={valueStyle} className="capitalize">{coverType}</div>
            </div>
          </div>
          
          <div style={labelStyle}>Quantity</div>
          <div style={valueStyle}>{quantity} {quantity === 1 ? 'copy' : 'copies'}</div>
        </div>

        <h2 style={{ ...headingStyle, fontSize: '18px' }}>Shipping Address</h2>
        
        <div style={detailsStyle}>
          <div style={{ ...valueStyle, marginBottom: '4px' }}>{shippingAddress.fullName}</div>
          <div style={{ ...textStyle, marginBottom: '4px', fontSize: '14px' }}>{shippingAddress.addressLine1}</div>
          {shippingAddress.addressLine2 && (
            <div style={{ ...textStyle, marginBottom: '4px', fontSize: '14px' }}>{shippingAddress.addressLine2}</div>
          )}
          <div style={{ ...textStyle, marginBottom: '4px', fontSize: '14px' }}>
            {shippingAddress.city}, {shippingAddress.state} - {shippingAddress.postalCode}
          </div>
          <div style={{ ...textStyle, marginBottom: '4px', fontSize: '14px' }}>{shippingAddress.country}</div>
          <div style={{ ...textStyle, fontSize: '14px' }}>Phone: {shippingAddress.phone}</div>
        </div>

        <div style={dividerStyle} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '18px', fontWeight: '500' }}>Total Paid</span>
          <span style={totalStyle}>{formattedAmount}</span>
        </div>

        <div style={dividerStyle} />

        <p style={textStyle}>
          We'll send you another email with tracking information once your order ships.
          You can also track your order status from your dashboard.
        </p>

        <p style={footerStyle}>
          Questions? Contact us at support@storyweave.app
          <br />
          Thank you for choosing StoryWeave!
        </p>
      </div>
    </div>
  );
};

export default OrderConfirmationEmail;
