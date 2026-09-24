'use client';

import { useState } from 'react';
import { RiEyeLine, RiEyeOffLine } from 'react-icons/ri';
import Input, { type InputProps } from '@/components/ui/Input';

type PasswordInputProps = Omit<InputProps, 'type' | 'trailingContent'>;

export default function PasswordInput(props: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return <Input
    {...props}
    type={visible ? 'text' : 'password'}
    trailingContent={<button
      type="button"
      disabled={props.disabled}
      onClick={() => setVisible(current => !current)}
      className="rounded p-1 text-on-surface-variant transition-colors hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim/30 disabled:opacity-50"
      aria-label={visible ? 'Ocultar senha' : 'Visualizar senha'}
      aria-pressed={visible}
    >{visible ? <RiEyeOffLine size={20} /> : <RiEyeLine size={20} />}</button>}
  />;
}
