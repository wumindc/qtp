'use client';

import { Modal, ModalBody, ModalFooter, ModalHeader, type ModalBackdropProps } from '@heroui/react';
import { useId, type ReactNode } from 'react';
import { QButton } from './q-button';

export type QModalProps = Omit<ModalBackdropProps, 'children'> & {
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
};

export interface QConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/**
 * @author codex
 * Standard modal wrapper for management-console dialogs.
 */
export function QModal({ title, description, children, footer, ...props }: QModalProps) {
  const titleId = useId();

  return (
    <Modal.Backdrop {...props}>
      <Modal.Container className="qtp-modal" scroll="inside">
        <Modal.Dialog aria-labelledby={titleId}>
          <ModalHeader>
            <div>
              <Modal.Heading id={titleId}>{title}</Modal.Heading>
              {description ? <p>{description}</p> : null}
            </div>
          </ModalHeader>
          <ModalBody>{children}</ModalBody>
          {footer ? <ModalFooter>{footer}</ModalFooter> : null}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

export function QConfirmDialog({ isOpen, title, description, confirmLabel, cancelLabel = '取消', onOpenChange, onConfirm }: QConfirmDialogProps) {
  return (
    <QModal
      isOpen={isOpen}
      title={title}
      description={description}
      onOpenChange={onOpenChange}
      footer={
        <>
          <QButton color="default" variant="secondary" onPress={() => onOpenChange(false)}>
            {cancelLabel}
          </QButton>
          <QButton color="danger" onPress={onConfirm}>
            {confirmLabel}
          </QButton>
        </>
      }
    />
  );
}
