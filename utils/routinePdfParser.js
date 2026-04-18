/**
 * PDF Routine Parser
 * Extracts structured routine data from uploaded PDF files
 */

const pdfParse = require('pdf-parse');
const fs = require('fs').promises;
const path = require('path');

class RoutinePdfParser {
    constructor() {
        this.parserVersion = '1.0.0';
        this.warnings = [];
    }

    /**
     * Parse PDF file and extract routine data
     */
    async parsePdf(filePath, options = {}) {
        try {
            const data = await fs.readFile(filePath);
            const pdfData = await pdfParse(data);
            
            return this.extractRoutineData(pdfData.text, options);
        } catch (error) {
            throw new Error(`PDF parsing failed: ${error.message}`);
        }
    }

    /**
     * Extract structured routine data from PDF text
     */
    extractRoutineData(text, options = {}) {
        this.warnings = [];
        
        // Clean and normalize text
        const cleanText = this.cleanText(text);
        
        // Try different parsing strategies
        let routineData = null;
        
        // Strategy 1: Table-based parsing
        if (this.hasTableStructure(cleanText)) {
            routineData = this.parseTableRoutine(cleanText, options);
        }
        // Strategy 2: Line-based parsing
        else {
            routineData = this.parseLineRoutine(cleanText, options);
        }
        
        // Validate and normalize the extracted data
        return this.validateAndNormalize(routineData, options);
    }

    /**
     * Clean and normalize PDF text
     */
    cleanText(text) {
        return text
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s\-\:\.\,\;\(\)\[\]\/\|]/g, ' ')
            .trim();
    }

    /**
     * Check if text has table structure
     */
    hasTableStructure(text) {
        // Look for patterns that suggest table structure
        const tableIndicators = [
            /\|\s*\w+\s*\|/, // Pipe-separated values
            /\t+\w+\t+/, // Tab-separated values
            /\s{3,}\w+\s{3,}/ // Multiple spaces
        ];
        
        return tableIndicators.some(pattern => pattern.test(text));
    }

    /**
     * Parse table-based routine
     */
    parseTableRoutine(text, options) {
        const lines = text.split('\n').filter(line => line.trim());
        const routineData = {
            schoolId: options.schoolId,
            sessionId: options.sessionId,
            classId: options.classId,
            sectionId: options.sectionId,
            entries: [],
            warnings: []
        };

        // Find header row with days
        let headerLine = null;
        let headerIndex = -1;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (this.containsDayNames(line)) {
                headerLine = line;
                headerIndex = i;
                break;
            }
        }

        if (!headerLine) {
            this.warnings.push('Could not find day names header');
            return routineData;
        }

        // Extract day columns
        const days = this.extractDaysFromHeader(headerLine);
        
        // Parse data rows
        for (let i = headerIndex + 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.toLowerCase().includes('period') || line.toLowerCase().includes('time')) {
                continue;
            }

            const row = this.parseTableRow(line, days);
            if (row) {
                routineData.entries.push(...row);
            }
        }

        return routineData;
    }

    /**
     * Parse line-based routine
     */
    parseLineRoutine(text, options) {
        const lines = text.split('\n').filter(line => line.trim());
        const routineData = {
            schoolId: options.schoolId,
            sessionId: options.sessionId,
            classId: options.classId,
            sectionId: options.sectionId,
            entries: [],
            warnings: []
        };

        let currentDay = null;
        let periodNumber = 1;

        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // Check for day names
            const dayMatch = trimmedLine.match(/^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i);
            if (dayMatch) {
                currentDay = this.capitalizeFirst(dayMatch[1]);
                periodNumber = 1;
                continue;
            }

            // Parse period information
            if (currentDay && this.looksLikePeriod(trimmedLine)) {
                const period = this.parsePeriodLine(trimmedLine, currentDay, periodNumber);
                if (period) {
                    routineData.entries.push(period);
                    periodNumber++;
                }
            }
        }

        return routineData;
    }

    /**
     * Check if line contains day names
     */
    containsDayNames(line) {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const lowerLine = line.toLowerCase();
        return days.some(day => lowerLine.includes(day));
    }

    /**
     * Extract days from header line
     */
    extractDaysFromHeader(headerLine) {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const foundDays = [];
        
        for (const day of days) {
            if (headerLine.toLowerCase().includes(day)) {
                foundDays.push(this.capitalizeFirst(day));
            }
        }
        
        return foundDays;
    }

    /**
     * Parse table row into period entries
     */
    parseTableRow(line, days) {
        const entries = [];
        
        // Split by common delimiters
        const parts = line.split(/\s*\|\s*|\s{2,}|\t+/);
        
        if (parts.length < 2) return null;

        // First part is usually period/time
        const periodInfo = parts[0];
        const periodNumber = this.extractPeriodNumber(periodInfo);
        const timeRange = this.extractTimeRange(periodInfo);

        // Process each day's entry
        for (let i = 1; i < parts.length && i - 1 < days.length; i++) {
            const cellContent = parts[i].trim();
            if (cellContent && cellContent !== '-' && cellContent !== 'N/A') {
                const entry = this.parseCellContent(cellContent, days[i - 1], periodNumber, timeRange);
                if (entry) {
                    entries.push(entry);
                }
            }
        }

        return entries.length > 0 ? entries : null;
    }

    /**
     * Parse line-based period
     */
    parsePeriodLine(line, day, periodNumber) {
        const timeRange = this.extractTimeRange(line);
        const subject = this.extractSubject(line);
        const teacher = this.extractTeacher(line);
        const room = this.extractRoom(line);

        return {
            dayOfWeek: day,
            periodNumber,
            startTime: timeRange?.start || '09:00',
            endTime: timeRange?.end || '09:45',
            subjectName: subject || 'Unknown',
            teacherName: teacher || 'Not Assigned',
            roomName: room || 'TBD'
        };
    }

    /**
     * Parse cell content into structured entry
     */
    parseCellContent(content, day, periodNumber, timeRange) {
        const subject = this.extractSubject(content);
        const teacher = this.extractTeacher(content);
        const room = this.extractRoom(content);

        return {
            dayOfWeek: day,
            periodNumber,
            startTime: timeRange?.start || '09:00',
            endTime: timeRange?.end || '09:45',
            subjectName: subject || content,
            teacherName: teacher || 'Not Assigned',
            roomName: room || 'TBD'
        };
    }

    /**
     * Extract period number from text
     */
    extractPeriodNumber(text) {
        const match = text.match(/(\d+)/);
        return match ? parseInt(match[1]) : 1;
    }

    /**
     * Extract time range from text
     */
    extractTimeRange(text) {
        const timeMatch = text.match(/(\d{1,2}:\d{2})\s*[-\s]\s*(\d{1,2}:\d{2})/);
        if (timeMatch) {
            return { start: timeMatch[1], end: timeMatch[2] };
        }
        return null;
    }

    /**
     * Extract subject from text
     */
    extractSubject(text) {
        // Common subject patterns
        const subjectPatterns = [
            /(math|mathematics|bangla|english|physics|chemistry|biology|history|geography|computer|science|arts|music|religion)/i,
            /^([A-Z][a-z]+)(?=\s|\()/ // Capitalized words
        ];

        for (const pattern of subjectPatterns) {
            const match = text.match(pattern);
            if (match) {
                return this.capitalizeFirst(match[1]);
            }
        }

        return null;
    }

    /**
     * Extract teacher name from text
     */
    extractTeacher(text) {
        // Look for patterns like "Mr. Smith", "Mrs. Johnson", etc.
        const teacherPatterns = [
            /(mr|mrs|ms|dr)\.?\s+[A-Z][a-z]+/i,
            /^[A-Z][a-z]+\s+[A-Z][a-z]+/ // Two capitalized words
        ];

        for (const pattern of teacherPatterns) {
            const match = text.match(pattern);
            if (match) {
                return match[0];
            }
        }

        return null;
    }

    /**
     * Extract room number from text
     */
    extractRoom(text) {
        const roomPatterns = [
            /room\s+(\w+)/i,
            /r(\d+)/i,
            /(\d{3})/ // 3-digit room numbers
        ];

        for (const pattern of roomPatterns) {
            const match = text.match(pattern);
            if (match) {
                return match[1] || match[0];
            }
        }

        return null;
    }

    /**
     * Check if line looks like a period entry
     */
    looksLikePeriod(line) {
        const indicators = [
            /\d{1,2}:\d{2}/, // Time format
            /(math|english|physics|chemistry|biology)/i, // Common subjects
            /(mr|mrs|ms|dr)/i // Teacher titles
        ];

        return indicators.some(pattern => pattern.test(line));
    }

    /**
     * Validate and normalize routine data
     */
    validateAndNormalize(routineData, options) {
        const validatedData = {
            ...routineData,
            entries: [],
            warnings: [...this.warnings],
            stats: {
                totalEntries: 0,
                validEntries: 0,
                invalidEntries: 0
            }
        };

        for (const entry of routineData.entries) {
            const normalizedEntry = this.normalizeEntry(entry);
            if (this.isValidEntry(normalizedEntry)) {
                validatedData.entries.push(normalizedEntry);
                validatedData.stats.validEntries++;
            } else {
                validatedData.warnings.push(`Invalid entry: ${JSON.stringify(entry)}`);
                validatedData.stats.invalidEntries++;
            }
            validatedData.stats.totalEntries++;
        }

        // Add validation warnings
        if (validatedData.stats.validEntries === 0) {
            validatedData.warnings.push('No valid routine entries found');
        }

        if (validatedData.stats.invalidEntries > 0) {
            validatedData.warnings.push(`${validatedData.stats.invalidEntries} entries were invalid and skipped`);
        }

        return validatedData;
    }

    /**
     * Normalize entry data
     */
    normalizeEntry(entry) {
        return {
            dayOfWeek: this.normalizeDay(entry.dayOfWeek),
            periodNumber: parseInt(entry.periodNumber) || 1,
            startTime: this.normalizeTime(entry.startTime),
            endTime: this.normalizeTime(entry.endTime),
            subjectName: this.capitalizeFirst(entry.subjectName || 'Unknown'),
            teacherName: this.capitalizeFirst(entry.teacherName || 'Not Assigned'),
            roomName: entry.roomName || 'TBD'
        };
    }

    /**
     * Normalize day name
     */
    normalizeDay(day) {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const normalized = day?.toLowerCase();
        return days.includes(normalized) ? this.capitalizeFirst(normalized) : day;
    }

    /**
     * Normalize time format
     */
    normalizeTime(time) {
        const timeMatch = time?.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) {
            const hours = timeMatch[1].padStart(2, '0');
            const minutes = timeMatch[2].padStart(2, '0');
            return `${hours}:${minutes}`;
        }
        return time || '00:00';
    }

    /**
     * Validate entry
     */
    isValidEntry(entry) {
        return (
            entry.dayOfWeek &&
            entry.periodNumber > 0 &&
            entry.startTime &&
            entry.endTime &&
            entry.subjectName
        );
    }

    /**
     * Capitalize first letter
     */
    capitalizeFirst(str) {
        if (!str) return str;
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }
}

module.exports = RoutinePdfParser;
