import type { Metadata } from 'next';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { App, ConfigProvider } from 'antd';
import type { ThemeConfig } from 'antd';
import './globals.css';

export const metadata: Metadata = {
  title: 'WhatIf To-Do',
  description: 'To-do list app built with Next.js and Ant Design',
};

const theme: ThemeConfig = {
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 8,
  },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body>
        {/* AntdRegistry collects antd's CSS-in-JS during SSR and injects it into
            <head>, so the first paint is styled (no flash of unstyled content). */}
        <AntdRegistry>
          <ConfigProvider theme={theme}>
            {/* <App> provides context-aware message/notification/modal via App.useApp(). */}
            <App>{children}</App>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
