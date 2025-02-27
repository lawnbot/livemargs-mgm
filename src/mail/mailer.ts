import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendMail = async (to: string, subject: string, text: string) => {
  const info = await transporter.sendMail({
    from: process.env.SMTP_USER,
    to,
    subject,
    text,
  });

  console.log('Email sent:', info.messageId);
};
