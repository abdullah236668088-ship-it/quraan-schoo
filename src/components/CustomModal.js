// src/components/CustomModal.js
import React, { useEffect, useRef } from 'react';
import '../Styles/CustomModalStyles.css';

const CustomModal = ({ isOpen, title, message, children, onConfirm, onCancel, showCancelButton = true, closeOnOverlayClick = false }) => {
    const modalRef = useRef(null);

    // Effect to manage focus and keyboard accessibility
    // تأثير لإدارة التركيز وإمكانية الوصول عبر لوحة المفاتيح
    useEffect(() => {
        if (isOpen) {
            // Focus the modal content when it opens
            // تركيز محتوى المودال عند فتحه
            modalRef.current?.focus();

            // Add event listener for Escape key to close modal
            // إضافة مستمع حدث لمفتاح Escape لإغلاق المودال
            const handleEscape = (event) => {
                if (event.key === 'Escape') {
                    onCancel(); // Use onCancel to close the modal
                }
            };
            document.addEventListener('keydown', handleEscape);

            // Cleanup function to remove event listener
            // دالة تنظيف لإزالة مستمع الحدث
            return () => {
                document.removeEventListener('keydown', handleEscape);
            };
        }
    }, [isOpen, onCancel]);

    // If modal is not open, return null to render nothing
    // إذا لم يكن المودال مفتوحًا، أعد قيمة null لعدم عرض أي شيء
    if (!isOpen) return null;

    // Handle overlay click to close modal if allowed
    // معالجة النقر على الخلفية لإغلاق المودال إذا كان مسموحًا
    const handleOverlayClick = (e) => {
        if (closeOnOverlayClick && modalRef.current && !modalRef.current.contains(e.target)) {
            onCancel();
        }
    };

    return (
        <div className="modal-overlay" onClick={handleOverlayClick}>
            <div
                className="modal-content"
                ref={modalRef}
                role="dialog" // ARIA role for dialog
                aria-modal="true" // Indicates that the dialog is modal
                aria-labelledby="modal-title" // Links to the title for accessibility
                aria-describedby="modal-message" // Links to the message for accessibility
                tabIndex="-1" // Makes the modal content focusable
            >
                <h3 id="modal-title" className="modal-title">{title}</h3>
                {message && <p id="modal-message" className="modal-message">{message}</p>}
                {children && <div className="modal-body">{children}</div>} {/* عرض المحتوى المخصص */}
                <div className="modal-actions">
                    <button onClick={onConfirm} className="modal-confirm-button">
                        تأكيد
                    </button>
                    {showCancelButton && (
                        <button onClick={onCancel} className="modal-cancel-button">
                            إلغاء
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CustomModal;
