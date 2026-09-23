import {
  useDeleteDetectorCommentFromKey,
  useGetDetectorComment,
  usePatchDetectorCommentFromKey,
  usePostDetectorComment,
} from '@/api/config'
import { useCellNavigation } from '@/features/locations/components/Cell/CellNavigation'
import DeleteConfirmationModal from '@/features/locations/components/editDetector/DeleteCommentConfirmationModal'
import { ConfigDetector } from '@/features/locations/components/editLocation/locationStore'
import { getApiErrorMessage } from '@/lib/apiError'
import { useNotificationStore } from '@/stores/notifications'
import ChatBubbleIcon from '@mui/icons-material/ChatBubble'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import {
  Badge,
  Box,
  Button,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Modal,
  Popover,
  TableCell,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from '@mui/material'
import { KeyboardEvent, MouseEvent, useEffect, useRef, useState } from 'react'

interface CommentCellProps {
  approachId: number
  detector: ConfigDetector
  row: number
  col: number
  rowCount: number
  colCount: number
}

const CommentCell = ({
  approachId,
  detector,
  row,
  col,
  rowCount,
  colCount,
}: CommentCellProps) => {
  const theme = useTheme()
  const {
    tabIndex,
    onFocus,
    onKeyDown: navKeyDown,
    isEditing,
    openEditor,
    closeEditor,
  } = useCellNavigation(approachId, row, col, rowCount, colCount)

  const cellRef = useRef<HTMLElement>(null)
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [editCommentId, setEditCommentId] = useState<number | null>(null)
  const [commentText, setCommentText] = useState('')

  const { refetch, data: commentsData } = useGetDetectorComment({
    filter: `detectorId eq ${detector.id}`,
  })
  const { mutateAsync: addComment, isPending: isAdding } =
    usePostDetectorComment()
  const { mutateAsync: deleteComment, isPending: isDeleting } =
    useDeleteDetectorCommentFromKey()
  const { mutateAsync: updateComment, isPending: isUpdating } =
    usePatchDetectorCommentFromKey()
  const { addNotification } = useNotificationStore()
  const isSaving = isAdding || isUpdating

  const comments =
    commentsData
      ?.slice()
      .sort(
        (a, b) =>
          new Date(b.timeStamp ?? 0).getTime() -
          new Date(a.timeStamp ?? 0).getTime()
      ) || []

  useEffect(() => {
    if (tabIndex === 0 && !isEditing && !modalOpen && !deleteModalOpen) {
      cellRef.current?.focus()
    }
  }, [tabIndex, isEditing, modalOpen, deleteModalOpen])

  const handleIconClick = (e: MouseEvent<HTMLElement>) => {
    if (detector.isNew) return
    if (!isEditing) {
      openEditor()
      setAnchorEl(e.currentTarget)
    }
  }

  const handleCellKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (detector.isNew || anchorEl) return
    if (e.key === 'Enter' && !isEditing) {
      e.preventDefault()
      openEditor()
      setAnchorEl(cellRef.current)
      return
    }
    if (isEditing && e.key === 'Escape') {
      e.preventDefault()
      closeEditor()
      setAnchorEl(null)
      return
    }
    if (!isEditing && e.key.startsWith('Arrow')) {
      e.preventDefault()
      navKeyDown(e)
      return
    }
    navKeyDown(e)
  }

  const handleClosePopover = () => {
    closeEditor()
    setAnchorEl(null)
  }

  const handleOpenModal = (id: number | null = null, text = '') => {
    cellRef.current?.blur()
    setEditCommentId(id)
    setCommentText(text)
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    if (isSaving) return
    setModalOpen(false)
    setEditCommentId(null)
  }

  const handleSaveComment = async () => {
    if (isSaving) return
    try {
      if (editCommentId !== null) {
        await updateComment({
          key: editCommentId,
          data: { comment: commentText },
        })
      } else {
        await addComment({
          data: {
            comment: commentText,
            detectorId: detector.id,
            timeStamp: new Date().toISOString(),
          },
        })
      }
      setCommentText('')
      setModalOpen(false)
      setEditCommentId(null)
      addNotification({ type: 'success', title: 'Comment saved' })
      void refetch()
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Error saving comment',
        message: getApiErrorMessage(error),
      })
    }
  }

  const handleOpenDeleteModal = (id: number | null) => {
    setEditCommentId(id)
    setDeleteModalOpen(true)
  }

  const handleCloseDeleteModal = () => {
    if (isDeleting) return
    setDeleteModalOpen(false)
    setEditCommentId(null)
  }

  const handleConfirmDelete = async () => {
    if (editCommentId === null || isDeleting) return
    try {
      await deleteComment({ key: editCommentId })
      setDeleteModalOpen(false)
      setEditCommentId(null)
      addNotification({ type: 'success', title: 'Comment deleted' })
      void refetch()
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Error deleting comment',
        message: getApiErrorMessage(error),
      })
    }
  }

  const outlineColor = theme.palette.primary.main
  const innerColor = alpha(outlineColor, 0.15)
  const isFocused = tabIndex === 0 && !isEditing && !modalOpen

  return (
    <TableCell
      ref={cellRef}
      role="gridcell"
      aria-rowindex={row + 1}
      aria-colindex={col + 1}
      aria-selected={isFocused}
      tabIndex={tabIndex}
      onFocusCapture={onFocus}
      onKeyDown={handleCellKeyDown}
      data-row={row}
      data-col={col}
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: 57,
        p: 0,
        position: 'relative',
        outline: 'none',
        bgcolor: isEditing ? innerColor : undefined,
        borderRight: `1px solid ${theme.palette.divider}`,
        caretColor: 'transparent',
      }}
    >
      {(isEditing || isFocused) && (
        <Box
          sx={{
            pointerEvents: 'none',
            position: 'absolute',
            inset: 0,
            border: `2px solid ${outlineColor}`,
            borderRadius: 1,
            zIndex: 1,
          }}
        />
      )}

      <Tooltip title={detector.isNew ? 'Save before commenting' : ''}>
        <span>
          <IconButton
            aria-label="View comments"
            onClick={handleIconClick}
            disabled={detector.isNew}
          >
            <Badge
              badgeContent={comments.length}
              color="primary"
              sx={{ cursor: detector.isNew ? 'not-allowed' : 'pointer' }}
            >
              <ChatBubbleIcon />
            </Badge>
          </IconButton>
        </span>
      </Tooltip>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClosePopover}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box
          className="skip-blur"
          p={2}
          sx={{ width: 400 }}
          onPointerDownCapture={(e) => e.stopPropagation()}
          onKeyDownCapture={(e) => e.stopPropagation()}
        >
          <List sx={{ maxHeight: 300, overflowY: 'auto' }}>
            {comments.length === 0 ? (
              <ListItem>
                <ListItemText primary="No comments" />
              </ListItem>
            ) : (
              comments.map((c) => (
                <ListItem key={c.id} divider alignItems="flex-start">
                  <ListItemText
                    primary={c.comment}
                    secondary={new Date(c.timeStamp ?? 0).toLocaleString()}
                  />
                  <Box>
                    <IconButton
                      aria-label="Edit comment"
                      size="small"
                      onClick={() =>
                        handleOpenModal(c.id ?? null, c.comment ?? '')
                      }
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      aria-label="Delete comment"
                      size="small"
                      onClick={() => handleOpenDeleteModal(c.id ?? null)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </ListItem>
              ))
            )}
          </List>
          {comments.length === 0 && <Divider />}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
            <Button variant="contained" onClick={() => handleOpenModal()}>
              Add New
            </Button>
          </Box>
        </Box>
      </Popover>

      <Modal open={modalOpen} onClose={handleCloseModal}>
        <Box
          onPointerDownCapture={(e) => e.stopPropagation()}
          onKeyDownCapture={(e) => e.stopPropagation()}
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-50%)',
            width: 400,
            bgcolor: 'background.paper',
            boxShadow: 24,
            p: 4,
          }}
        >
          <Typography variant="h6" gutterBottom>
            {editCommentId !== null ? 'Edit Comment' : 'Add Comment'}
          </Typography>
          <TextField
            label="Comment"
            disabled={isSaving}
            autoFocus
            fullWidth
            multiline
            rows={4}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button onClick={handleCloseModal} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveComment}
              disabled={isSaving}
              variant="contained"
              sx={{ ml: 1 }}
            >
              Save
            </Button>
          </Box>
        </Box>
      </Modal>

      <DeleteConfirmationModal
        open={deleteModalOpen}
        onClose={handleCloseDeleteModal}
        onDelete={handleConfirmDelete}
        isDeleting={isDeleting}
        commentText={
          comments.find((c) => c.id === editCommentId)?.comment || ''
        }
      />
    </TableCell>
  )
}

export default CommentCell
