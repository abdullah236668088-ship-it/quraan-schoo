// src/utils/csvImporter.js
import { collection, doc, writeBatch } from "firebase/firestore";

/**
 * دالة لاستيراد الطلاب من ملف CSV إلى Firestore.
 * تتعامل مع قراءة الملف، تحليل البيانات، والتحقق من صحتها، ثم كتابتها إلى Firestore كدفعة.
 *
 * @param {File} csvFile - ملف CSV المراد استيراده.
 * @param {object} db - كائن قاعدة بيانات Firestore.
 * @param {function} validateStudentData - دالة للتحقق من صحة بيانات كل طالب (يجب توفيرها من المكون الذي يستدعيها).
 * @param {function} setLoading - دالة لتحديث حالة التحميل في المكون الأب.
 * @param {function} setError - دالة لتحديث رسائل الخطأ في المكون الأب.
 * @param {function} setMessage - دالة لتحديث رسائل النجاح في المكون الأب.
 */
export const importStudentsFromCSV = async (
    csvFile,
    db,
    validateStudentData, // دالة التحقق من صحة البيانات
    setLoading,
    setError,
    setMessage
) => {
    // التحقق مما إذا كان الملف موجودًا
    if (!csvFile) {
        setError("الرجاء تحديد ملف CSV أولاً.");
        return;
    }

    setLoading(true); // بدء التحميل
    setError("");      // مسح الأخطاء السابقة
    setMessage("");    // مسح الرسائل السابقة

    const reader = new FileReader(); // إنشاء كائن FileReader لقراءة الملف

    // معالج حدث عند اكتمال قراءة الملف
    reader.onload = async (event) => {
        try {
            const csvData = event.target.result; // الحصول على محتوى الملف كـ string
            // تقسيم المحتوى إلى أسطر، وتصفية الأسطر الفارغة
            const lines = csvData.split(/\r\n|\n/).filter(line => line.trim() !== '');

            // التحقق من أن الملف يحتوي على بيانات كافية (على الأقل سطرين: عناوين ورأس)
            if (lines.length < 2) {
                throw new Error("الملف فارغ أو يحتوي على العناوين فقط.");
            }

            // تحليل العناوين من السطر الأول
            const headers = lines[0].split(",").map(h => h.trim());
            // العناوين المطلوبة لضمان صحة البيانات
            const requiredHeaders = ["name", "halaqaId", "gender", "birthDate", "contactNumber", "memorization", "notes"];
            // التحقق من وجود جميع العناوين المطلوبة
            const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

            if (missingHeaders.length > 0) {
                throw new Error(`ملف CSV يجب أن يحتوي على الأعمدة التالية على الأقل: ${requiredHeaders.join(', ')}`);
            }

            const batch = writeBatch(db); // بدء عملية كتابة دفعة (batch write) لزيادة الكفاءة
            const studentsCollectionRef = collection(db, "students"); // مرجع لمجموعة الطلاب

            // معالجة كل سطر من البيانات (بدءًا من السطر الثاني، بعد العناوين)
            for (let i = 1; i < lines.length; i++) {
                const data = lines[i].split(","); // تقسيم السطر إلى بيانات بناءً على الفاصلة
                // إنشاء كائن studentData من العناوين والبيانات
                const studentData = headers.reduce((obj, header, index) => ({ ...obj, [header]: data[index] ? data[index].trim() : "" }), {});

                // تعيين قيمة افتراضية للجنس إذا لم تكن موجودة
                if (!studentData.gender) studentData.gender = "ذكر";

                // التحقق من صحة بيانات الطالب باستخدام الدالة الممررة
                const validationError = validateStudentData(studentData);
                if (validationError) {
                    throw new Error(`خطأ في بيانات الصف ${i + 1}: ${validationError}`);
                }

                // إضافة عملية تعيين (set) لكل وثيقة طالب إلى الدفعة
                // يتم إنشاء معرف جديد للوثيقة تلقائيًا
                batch.set(doc(studentsCollectionRef), studentData);
            }

            await batch.commit(); // تنفيذ جميع عمليات الكتابة في الدفعة
            setMessage(`تم استيراد ${lines.length - 1} طالب بنجاح! سيتم تحديث القائمة تلقائياً.`);
        } catch (err) {
            console.error("Error importing CSV:", err);
            // عرض رسالة خطأ مفصلة للمستخدم
            setError(`فشل في استيراد الملف: ${err.message}. تأكد من أن ترتيب الأعمدة هو: name,halaqaId,gender,birthDate,contactNumber,memorization,notes`);
        } finally {
            setLoading(false); // إنهاء التحميل في كل الأحوال
        }
    };

    // معالج حدث عند حدوث خطأ في قراءة الملف
    reader.onerror = () => {
        setLoading(false);
        setError("فشل في قراءة الملف.");
    };

    // قراءة الملف كـ نص
    reader.readAsText(csvFile);
};
