import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SimpleListPage } from './simple-list-page';

describe('SimpleListPage', () => {
  it('renders a titled list page', () => {
    render(
      <SimpleListPage
        title="AI 应用"
        description="管理被测 AI 应用"
        columns={['名称', '状态']}
        rows={[['演示信用服务助手', '启用']]}
      />,
    );

    expect(screen.getByText('AI 应用')).toBeInTheDocument();
    expect(screen.getByText('演示信用服务助手')).toBeInTheDocument();
  });
});
