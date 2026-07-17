import { useEffect, useRef, useState } from "react";
import {
  deleteMeetingAttachment,
  downloadMeetingAttachment,
  getMeetingAttachments,
  uploadMeetingAttachment,
  type MeetingAttachment,
} from "../../../api/meetingApi";
import { ConfirmDialog } from "../../../common/dialog";
import { LoadingOverlay } from "../../../common/loading";
import { formatDateTime, type MeetingReportController } from "./useMeetingReport";
import reportStyles from "./ConferenceReport.module.css";

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const ATTACHMENT_ACCEPT = [
  ".pdf", ".txt", ".csv",
  ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".hwp", ".hwpx",
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif",
  ".zip", ".7z", ".rar",
].join(",");

type AttachmentSectionProps = {
  report: MeetingReportController;
  agendaId: number;
  initialCount: number;
};

// 파일 크기를 읽기 쉬운 단위로 변환
function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

// 브라우저 다운로드 링크 생성 후 임시 URL 정리
function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

// 안건별 첨부파일 조회·업로드·다운로드·삭제 영역
export function AttachmentSection({ report, agendaId, initialCount }: AttachmentSectionProps) {
  const { detail, showRequestError, setAlertMessage, setAlertOpen } = report;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MeetingAttachment | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [attachments, setAttachments] = useState<MeetingAttachment[]>([]);

  // 첨부파일 영역을 처음 열 때 목록 조회
  useEffect(() => {
    if (!open || loaded) return;
    let alive = true;
    setLoading(true);
    getMeetingAttachments(agendaId)
      .then((rows) => {
        if (!alive) return;
        setAttachments(rows);
        setLoaded(true);
      })
      .catch((error) => {
        if (alive) showRequestError(error, "첨부파일 목록을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [agendaId, loaded, open, showRequestError]);

  // 파일 선택과 10MB 크기 사전 검사
  const handleSelectFile = (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_SIZE) {
      showRequestError(new Error("첨부파일은 10MB 이하만 업로드할 수 있습니다."));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setSelectedFile(file);
    setOpen(true);
  };

  // 선택한 파일 업로드 후 목록 갱신
  const handleUpload = async () => {
    if (!selectedFile || uploading) return;
    setUploadProgress(0);
    setUploading(true);
    try {
      await uploadMeetingAttachment(agendaId, selectedFile, setUploadProgress);
      const rows = await getMeetingAttachments(agendaId);
      setAttachments(rows);
      setLoaded(true);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setAlertMessage("첨부파일이 업로드되었습니다.");
      setAlertOpen(true);
    } catch (error) {
      showRequestError(error, "첨부파일을 업로드하지 못했습니다.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // 선택한 첨부파일 다운로드
  const handleDownload = async (attachment: MeetingAttachment) => {
    if (downloadingId !== null) return;
    setDownloadingId(attachment.id);
    try {
      const blob = await downloadMeetingAttachment(attachment.id);
      saveBlob(blob, attachment.fileName);
    } catch (error) {
      showRequestError(error, "첨부파일을 내려받지 못했습니다.");
    } finally {
      setDownloadingId(null);
    }
  };

  // 삭제 확인된 첨부파일을 Drive와 목록에서 제거
  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setDeleting(true);
    try {
      await deleteMeetingAttachment(target.id);
      setAttachments((prev) => prev.filter((attachment) => attachment.id !== target.id));
      setAlertMessage("첨부파일이 삭제되었습니다.");
      setAlertOpen(true);
    } catch (error) {
      showRequestError(error, "첨부파일을 삭제하지 못했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  const canUpload = detail?.participants.some((participant) => participant.user_id === detail.currentUserId) ?? false;
  const attachmentCount = loaded ? attachments.length : initialCount;
  const uploadStatus = uploadProgress >= 100 ? "Drive에 저장하는 중" : `${uploadProgress}%`;

  return (
    <div className={reportStyles.attachmentPanel}>
      <div className={reportStyles.attachmentPanelTitle} onClick={() => setOpen((prev) => !prev)}>
        <div className={reportStyles.attachmentTitleGroup}>
          <strong>첨부파일</strong>
          <span className={reportStyles.commentCount}>{attachmentCount}</span>
        </div>
        {canUpload && (
          <button
            type="button"
            className={reportStyles.inlineAddButton}
            onClick={(event) => {
              event.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            +파일 추가
          </button>
        )}
        <span className={`${reportStyles.chevron} ${reportStyles.attachmentHeaderChevron} ${open ? reportStyles.chevronOpen : ""}`}>›</span>
      </div>

      <input
        ref={fileInputRef}
        className={reportStyles.hiddenFileInput}
        type="file"
        accept={ATTACHMENT_ACCEPT}
        onChange={(event) => handleSelectFile(event.target.files?.[0] ?? null)}
      />

      {open && (
        <div className={reportStyles.attachmentContent}>
          {selectedFile && (
            <div className={reportStyles.attachmentUploadRow}>
              <div>
                <strong>{selectedFile.name}</strong>
                <span>{formatFileSize(selectedFile.size)}</span>
              </div>
              <div className={reportStyles.attachmentActions}>
                {uploading && (
                  <div
                    className={reportStyles.attachmentProgressInline}
                    role="progressbar"
                    aria-label="첨부파일 업로드 진행률"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={uploadProgress}
                  >
                    <span>{uploadStatus}</span>
                    <div className={reportStyles.attachmentProgressTrack}>
                      <i style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                )}
                <button type="button" className={reportStyles.primaryButton} disabled={uploading} onClick={handleUpload}>
                  {uploading ? "업로드 중" : "업로드"}
                </button>
                <button type="button" className={reportStyles.ghostButton} disabled={uploading} onClick={() => setSelectedFile(null)}>
                  취소
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className={reportStyles.attachmentLoading} aria-label="첨부파일 불러오는 중">
              <span /><span /><span />
            </div>
          ) : (
            <div className={reportStyles.attachmentList}>
              {attachments.map((attachment) => {
                const canDelete =
                  attachment.uploadedBy === detail?.currentUserId || detail?.meeting.created_by === detail?.currentUserId;
                return (
                  <div className={reportStyles.attachmentItem} key={attachment.id}>
                    <button
                      type="button"
                      className={reportStyles.attachmentFileButton}
                      disabled={downloadingId !== null}
                      onClick={() => handleDownload(attachment)}
                    >
                      <strong>{attachment.fileName}</strong>
                      <span>{formatFileSize(attachment.fileSize)} · {attachment.uploaderName}</span>
                    </button>
                    <span className={reportStyles.attachmentDate}>{formatDateTime(attachment.uploadedAt.slice(0, 16))}</span>
                    {canDelete && (
                      <button type="button" className={reportStyles.dangerButton} onClick={() => setDeleteTarget(attachment)}>
                        삭제
                      </button>
                    )}
                  </div>
                );
              })}
              {loaded && attachments.length === 0 && !selectedFile && (
                <p className={reportStyles.commentEmpty}>등록된 첨부파일이 없습니다.</p>
              )}
            </div>
          )}
        </div>
      )}

      {uploading && selectedFile && (
        <div className={reportStyles.attachmentUploadModal} role="dialog" aria-modal="true" aria-label="첨부파일 업로드 중">
          <div className={reportStyles.attachmentUploadModalPanel}>
            <strong>{selectedFile.name}</strong>
            <span>{uploadStatus}</span>
            <div
              className={reportStyles.attachmentProgressTrack}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={uploadProgress}
            >
              <i style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        </div>
      )}

      <LoadingOverlay
        active={deleting}
        delayMs={0}
        fixed
        label="첨부파일 삭제 중"
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="첨부파일 삭제"
        message="첨부파일을 삭제하시겠습니까?"
        cancelLabel="아니요"
        confirmLabel="예"
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
