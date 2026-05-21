import { Button, Modal, ModalBody, ModalFooter, ModalHeader, type ModalProps } from '@heroui/react';
import type { ReactNode } from 'react';

export type QModalProps = Omit<ModalProps, 'children'> & {
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
  return (
    <Modal {...props}>
      <Modal.Backdrop>
        <Modal.Container data-radius="sm" scroll="inside">
          <Modal.Dialog aria-labelledby="qtp-modal-title">
        <ModalHeader>
          <div>
            <Modal.Heading id="qtp-modal-title">{title}</Modal.Heading>
            {description ? <p>{description}</p> : null}
          </div>
        </ModalHeader>
        <ModalBody>{children}</ModalBody>
        {footer ? <ModalFooter>{footer}</ModalFooter> : null}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
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
          <Button data-radius="sm" variant="secondary" onPress={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button data-color="danger" data-radius="sm" variant="danger" onPress={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
