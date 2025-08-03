// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

// قم بتهيئة Firebase Admin SDK
// إذا كنت تقوم بتشغيل هذا في بيئة Cloud Functions، فسيتم تهيئته تلقائيًا.
// إذا كنت تقوم بتشغيله محليًا، ستحتاج إلى ملف مفتاح الخدمة:
// admin.initializeApp({
//   credential: admin.credential.cert(require('./path/to/your/serviceAccountKey.json'))
// });
admin.initializeApp();

const db = admin.firestore();

/**
 * وظيفة Firebase Cloud Function مجدولة لأرشفة وتصفية التقارير الأسبوعية القديمة.
 * يتم تشغيل هذه الوظيفة مرة واحدة سنويًا في 1 يناير في منتصف الليل.
 *
 * المنطق:
 * 1. تحدد جميع التقارير الأسبوعية التي يزيد عمرها عن عام واحد.
 * 2. تلخص البيانات الرئيسية (الصفحات المحفوظة، الأجزاء المراجعة، أيام الحضور) لكل طالب لتلك السنة.
 * 3. تحفظ هذه الملخصات السنوية في مجموعة 'annualSummaries'.
 * 4. تحذف التقارير الأسبوعية الفردية التي تم تلخيصها لتنظيف قاعدة البيانات.
 *
 * ملاحظة: تأكد من أن قواعد أمان Firestore تسمح لهذه الوظيفة بالوصول إلى المجموعات المطلوبة.
 */
exports.archiveOldWeeklyReports = functions.runWith({
    timeoutSeconds: 540, // زيادة مهلة التنفيذ إلى 9 دقائق (الحد الأقصى)
    memory: '1GB' // زيادة الذاكرة إذا كانت العملية كثيفة الموارد
}).pubsub.schedule('0 0 1 Jan *').onRun(async (context) => {
    const now = new Date();
    // تحديد التاريخ قبل عام واحد من الآن
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    console.log(`Starting archival process for reports older than: ${oneYearAgo.toISOString()}`);

    try {
        // 1. جلب جميع التقارير الأسبوعية التي يزيد عمرها عن عام واحد
        const weeklyReportsRef = db.collection('weeklyReports');
        const oldReportsQuery = weeklyReportsRef.where('reportDate', '<', oneYearAgo);
        const oldReportsSnapshot = await oldReportsQuery.get();

        if (oldReportsSnapshot.empty) {
            console.log('No old weekly reports found to archive.');
            return null;
        }

        const reportsToArchive = [];
        const reportsToDelete = [];
        oldReportsSnapshot.forEach(doc => {
            reportsToArchive.push({ id: doc.id, ...doc.data() });
            reportsToDelete.push(doc.ref);
        });

        console.log(`Found ${reportsToArchive.length} old weekly reports to process.`);

        // 2. تلخيص البيانات الرئيسية لكل طالب لتلك السنة
        const annualSummaries = {}; // { studentId: { year: { totalPages, totalParts, totalAttendance } } }

        reportsToArchive.forEach(report => {
            const studentId = report.studentId;
            // تأكد من أن reportDate هو كائن Date قبل استدعاء getFullYear
            const reportDate = report.reportDate && typeof report.reportDate.toDate === 'function' ? report.reportDate.toDate() : new Date(report.reportDate);
            const reportYear = reportDate.getFullYear(); // الحصول على السنة من تاريخ التقرير

            if (!annualSummaries[studentId]) {
                annualSummaries[studentId] = {};
            }
            if (!annualSummaries[studentId][reportYear]) {
                annualSummaries[studentId][reportYear] = {
                    totalPagesMemorized: 0,
                    totalPartsRevised: 0,
                    totalAttendanceDays: 0,
                    reportCount: 0,
                };
            }

            annualSummaries[studentId][reportYear].totalPagesMemorized += report.pagesMemorized || 0;
            annualSummaries[studentId][reportYear].totalPartsRevised += report.partsRevised || 0;
            annualSummaries[studentId][reportYear].totalAttendanceDays += report.attendanceDays || 0;
            annualSummaries[studentId][reportYear].reportCount++;
        });

        // حفظ الملخصات السنوية في مجموعة 'annualSummaries'
        const annualSummariesCollectionRef = db.collection('annualSummaries');
        const summaryBatch = db.batch();
        let summariesCount = 0;

        for (const studentId in annualSummaries) {
            for (const year in annualSummaries[studentId]) {
                const summaryData = annualSummaries[studentId][year];
                const summaryDocRef = annualSummariesCollectionRef.doc(`${studentId}_${year}`); // معرف فريد للملخص
                summaryBatch.set(summaryDocRef, {
                    studentId: studentId,
                    year: parseInt(year),
                    ...summaryData,
                    archivedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true }); // استخدم merge لتحديث إذا كان موجودًا
                summariesCount++;
            }
        }

        if (summariesCount > 0) {
            await summaryBatch.commit();
            console.log(`Successfully saved ${summariesCount} annual summaries.`);
        } else {
            console.log("No annual summaries to save.");
        }


        // 3. حذف التقارير الأسبوعية التفصيلية القديمة
        // يمكن أن تكون هناك قيود على عدد العمليات في دفعة واحدة (500 عملية كحد أقصى).
        // إذا كان لديك عدد كبير جدًا من التقارير، ستحتاج إلى تقسيمها إلى دفعات متعددة.
        let deleteBatch = db.batch();
        let deletedCount = 0;
        for (let i = 0; i < reportsToDelete.length; i++) {
            deleteBatch.delete(reportsToDelete[i]);
            deletedCount++;

            // التزام بالدفعة إذا وصلت إلى 500 عملية أو كانت هي الأخيرة
            if (deletedCount % 500 === 0 || i === reportsToDelete.length - 1) {
                await deleteBatch.commit();
                console.log(`Deleted ${deletedCount} reports so far.`);
                // ابدأ دفعة جديدة إذا لم تكن هي الأخيرة
                if (i !== reportsToDelete.length - 1) {
                    deleteBatch = db.batch();
                }
            }
        }

        console.log(`Successfully deleted ${deletedCount} old weekly reports.`);
        return null; // يجب أن تعيد الوظائف السحابية قيمة null أو Promise
    } catch (error) {
        console.error('Error during archival process:', error);
        // يمكنك إرسال إشعار (مثل البريد الإلكتروني أو Slack) هنا في حالة الفشل
        // مثال:
        // const sgMail = require('@sendgrid/mail');
        // sgMail.setApiKey(functions.config.sendgrid.key);
        // const msg = {
        //   to: 'admin@example.com',
        //   from: 'noreply@your-app.com',
        //   subject: 'Firebase Function Error: Archival Process Failed',
        //   text: `An error occurred during the archival process: ${error.message}`,
        // };
        // await sgMail.send(msg);
        return null; // يجب أن تعيد الوظائف السحابية قيمة null أو Promise
    }
});
