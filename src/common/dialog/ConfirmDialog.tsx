import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
};

type AlertDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onClose: () => void;
};

// 예/아니요 선택이 필요한 공통 확인창
export function ConfirmDialog({
  open,
  title,
  message,
  cancelLabel,
  confirmLabel,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      sx={{
        zIndex: 20000,
        "& .MuiBackdrop-root": {
          borderRadius: "16px",
          padding: "8px 4px",
          minWidth: "320px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.28)",
        },
      }}
    >
      <DialogTitle>{title}</DialogTitle>

      <DialogContent>{message}</DialogContent>

      <DialogActions
        sx={{
          justifyContent: "center",
          gap: 1,
          paddingBottom: "5px",
          marginBottom: "2px",
        }}
      >
        <Button onClick={onClose}>{cancelLabel}</Button>

        <Button color="error" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// 확인 버튼 하나만 필요한 공통 안내창
export function AlertDialog({
  open,
  title,
  message,
  confirmLabel = "확인",
  onClose,
}: AlertDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      sx={{
        zIndex: 20000,
        "& .MuiBackdrop-root": {
          borderRadius: "16px",
          padding: "8px 4px",
          minWidth: "320px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.28)",
        },
      }}
    >
      <DialogTitle>{title}</DialogTitle>

      <DialogContent>{message}</DialogContent>

      <DialogActions
        sx={{
          justifyContent: "center",
          gap: 1,
          paddingBottom: "5px",
          marginBottom: "2px",
        }}
      >
        <Button onClick={onClose}>{confirmLabel}</Button>
      </DialogActions>
    </Dialog>
  );
}
