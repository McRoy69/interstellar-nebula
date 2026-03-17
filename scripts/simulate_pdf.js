
import jsPDF from 'jspdf';
import 'jspdf-autotable';

function simulateExport() {
    try {
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a3'
        });

        const activeTab = 'Plan';
        const dataName = 'Brünieren';
        const dateString = '2026-03-12';

        const safeTab = activeTab.replace(/[^a-z0-9]/gi, '_');
        const safeName = dataName.replace(/[^a-z0-9]/gi, '_');
        const filename = `Reporte_${safeTab}_${safeName}_${dateString}.pdf`;

        console.log('Generated Filename:', filename);

        // Simulate some content
        doc.text('Test Report', 20, 20);

        // In a real browser, doc.save() triggers a download.
        // Here we just check if it runs without error.
        console.log('Simulating doc.save()...');
        // doc.save(filename); // This would fail in Node.js

        console.log('Simulation complete.');
    } catch (error) {
        console.error('Simulation failed:', error);
    }
}

simulateExport();
