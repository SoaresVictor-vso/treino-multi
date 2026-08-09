'use client';

import type { ReactNode } from 'react';
import Modal from '@/components/ui/Modal';

/** Shared shell for registering or warning about personal-record references. */
export default function PersonalRecordModal({ isOpen, title, description, onClose, children }: { isOpen: boolean; title: string; description?: string; onClose: () => void; children: ReactNode }) {
	return <Modal isOpen={isOpen} title={title} description={description} onClose={onClose}>{children}</Modal>;
}
