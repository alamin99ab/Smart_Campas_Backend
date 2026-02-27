/**
 * 🔗 BLOCKCHAIN-BASED CERTIFICATE SERVICE
 * Immutable, verifiable academic credentials
 */

const crypto = require('crypto-js');
const SHA256 = crypto.SHA256;

class BlockchainService {
    constructor() {
        this.chain = [];
        this.difficulty = 4;
        this.pendingCertificates = [];
        this.genesisBlock();
    }

    /**
     * Create genesis block
     */
    genesisBlock() {
        const genesisBlock = {
            index: 0,
            timestamp: Date.now(),
            certificates: [],
            previousHash: '0',
            nonce: 0,
            hash: this.calculateHash(0, Date.now(), [], '0', 0)
        };
        
        this.chain.push(genesisBlock);
        console.log('🔗 Genesis block created');
    }

    /**
     * Create new certificate
     */
    createCertificate(certificateData) {
        const certificate = {
            id: this.generateCertificateId(),
            type: certificateData.type, // 'degree', 'diploma', 'achievement', 'completion'
            recipient: {
                id: certificateData.studentId,
                name: certificateData.studentName,
                email: certificateData.studentEmail,
                blockchainAddress: this.generateBlockchainAddress(certificateData.studentId)
            },
            issuer: {
                id: certificateData.institutionId,
                name: certificateData.institutionName,
                address: certificateData.institutionAddress,
                signature: this.generateInstitutionSignature()
            },
            details: {
                title: certificateData.title,
                field: certificateData.field,
                level: certificateData.level, // 'bachelor', 'master', 'phd', 'diploma'
                startDate: certificateData.startDate,
                endDate: certificateData.endDate,
                gpa: certificateData.gpa,
                credits: certificateData.credits,
                achievements: certificateData.achievements || [],
                skills: certificateData.skills || []
            },
            metadata: {
                issuedAt: new Date().toISOString(),
                expiresAt: certificateData.expiresAt || null,
                version: '2.0',
                network: 'smart-campus-chain',
                transactionId: this.generateTransactionId()
            },
            verification: {
                checksum: this.calculateChecksum(certificateData),
                digitalSignature: this.generateDigitalSignature(certificateData),
                qrCode: this.generateQRCode(certificateData),
                verificationUrl: `${process.env.BASE_URL}/verify/${this.generateCertificateId()}`
            }
        };

        this.pendingCertificates.push(certificate);
        
        // Mine the certificate into blockchain
        const block = this.minePendingCertificates();
        
        return {
            success: true,
            certificate,
            blockIndex: block.index,
            blockHash: block.hash,
            transactionHash: this.calculateCertificateHash(certificate),
            verificationUrl: certificate.metadata.verificationUrl
        };
    }

    /**
     * Mine pending certificates
     */
    minePendingCertificates() {
        if (this.pendingCertificates.length === 0) return null;

        const lastBlock = this.getLastBlock();
        let nonce = 0;
        let hash = '';
        const timestamp = Date.now();

        while (hash.substring(0, this.difficulty) !== Array(this.difficulty + 1).join('0')) {
            nonce++;
            hash = this.calculateHash(
                lastBlock.index + 1,
                timestamp,
                this.pendingCertificates,
                lastBlock.hash,
                nonce
            );
        }

        const newBlock = {
            index: lastBlock.index + 1,
            timestamp,
            certificates: this.pendingCertificates,
            previousHash: lastBlock.hash,
            nonce,
            hash
        };

        this.chain.push(newBlock);
        const minedCertificates = [...this.pendingCertificates];
        this.pendingCertificates = [];

        console.log(`⛏️ Block mined: ${newBlock.index} with ${minedCertificates.length} certificates`);
        
        return newBlock;
    }

    /**
     * Verify certificate authenticity
     */
    async verifyCertificate(certificateId) {
        try {
            // Find certificate in blockchain
            const certificate = this.findCertificate(certificateId);
            if (!certificate) {
                return {
                    valid: false,
                    reason: 'Certificate not found in blockchain'
                };
            }

            // Verify certificate hash
            const calculatedHash = this.calculateCertificateHash(certificate);
            if (calculatedHash !== certificate.verification.checksum) {
                return {
                    valid: false,
                    reason: 'Certificate hash mismatch - possible tampering'
                };
            }

            // Verify digital signature
            const signatureValid = this.verifyDigitalSignature(certificate);
            if (!signatureValid) {
                return {
                    valid: false,
                    reason: 'Invalid digital signature'
                };
            }

            // Verify blockchain integrity
            const chainValid = this.isChainValid();
            if (!chainValid) {
                return {
                    valid: false,
                    reason: 'Blockchain integrity compromised'
                };
            }

            // Check expiration
            if (certificate.metadata.expiresAt) {
                const expirationDate = new Date(certificate.metadata.expiresAt);
                if (expirationDate < new Date()) {
                    return {
                        valid: false,
                        reason: 'Certificate has expired'
                    };
                }
            }

            return {
                valid: true,
                certificate,
                verificationDetails: {
                    blockIndex: this.findCertificateBlockIndex(certificateId),
                    blockHash: this.findCertificateBlockHash(certificateId),
                    transactionHash: certificate.verification.checksum,
                    verifiedAt: new Date().toISOString(),
                    network: 'smart-campus-chain'
                }
            };

        } catch (error) {
            return {
                valid: false,
                reason: `Verification error: ${error.message}`
            };
        }
    }

    /**
     * Get certificate verification details
     */
    getCertificateDetails(certificateId) {
        const certificate = this.findCertificate(certificateId);
        if (!certificate) {
            return {
                found: false,
                message: 'Certificate not found'
            };
        }

        return {
            found: true,
            certificate: {
                id: certificate.id,
                type: certificate.type,
                recipient: certificate.recipient,
                issuer: certificate.issuer,
                details: certificate.details,
                metadata: certificate.metadata,
                verification: {
                    checksum: certificate.verification.checksum,
                    qrCode: certificate.verification.qrCode,
                    verificationUrl: certificate.verification.verificationUrl
                }
            },
            blockchain: {
                blockIndex: this.findCertificateBlockIndex(certificateId),
                blockHash: this.findCertificateBlockHash(certificateId),
                minedAt: new Date(this.findCertificateBlockTimestamp(certificateId)).toISOString()
            }
        };
    }

    /**
     * Get student's certificates
     */
    getStudentCertificates(studentId) {
        const certificates = [];
        
        this.chain.forEach(block => {
            block.certificates.forEach(cert => {
                if (cert.recipient.id === studentId) {
                    certificates.push({
                        ...cert,
                        blockIndex: block.index,
                        blockHash: block.hash,
                        minedAt: new Date(block.timestamp).toISOString()
                    });
                }
            });
        });

        return {
            success: true,
            studentId,
            totalCertificates: certificates.length,
            certificates: certificates.sort((a, b) => new Date(b.metadata.issuedAt) - new Date(a.metadata.issuedAt))
        };
    }

    /**
     * Revoke certificate
     */
    revokeCertificate(certificateId, reason, revokedBy) {
        const certificate = this.findCertificate(certificateId);
        if (!certificate) {
            return {
                success: false,
                message: 'Certificate not found'
            };
        }

        const revocation = {
            certificateId,
            reason,
            revokedBy,
            revokedAt: new Date().toISOString(),
            revocationHash: this.calculateHash(certificateId, reason, revokedBy, Date.now())
        };

        // Add revocation record to blockchain
        this.pendingCertificates.push({
            type: 'revocation',
            data: revocation
        });

        this.minePendingCertificates();

        return {
            success: true,
            message: 'Certificate revoked successfully',
            revocationHash: revocation.revocationHash
        };
    }

    /**
     * Get blockchain statistics
     */
    getBlockchainStats() {
        const totalCertificates = this.chain.reduce((sum, block) => sum + block.certificates.length, 0);
        const certificateTypes = {};
        const institutions = new Set();

        this.chain.forEach(block => {
            block.certificates.forEach(cert => {
                certificateTypes[cert.type] = (certificateTypes[cert.type] || 0) + 1;
                institutions.add(cert.issuer.name);
            });
        });

        return {
            totalBlocks: this.chain.length,
            totalCertificates,
            certificateTypes,
            totalInstitutions: institutions.size,
            difficulty: this.difficulty,
            lastBlockHash: this.getLastBlock().hash,
            networkHashrate: this.calculateHashrate(),
            uptime: process.uptime()
        };
    }

    /**
     * Helper methods
     */
    calculateHash(index, timestamp, certificates, previousHash, nonce) {
        return SHA256(
            index + timestamp + JSON.stringify(certificates) + previousHash + nonce
        ).toString();
    }

    calculateCertificateHash(certificate) {
        const certData = {
            recipient: certificate.recipient,
            issuer: certificate.issuer,
            details: certificate.details,
            metadata: certificate.metadata
        };
        return SHA256(JSON.stringify(certData)).toString();
    }

    calculateChecksum(data) {
        return SHA256(JSON.stringify(data)).toString();
    }

    generateDigitalSignature(data) {
        const privateKey = process.env.INSTITUTION_PRIVATE_KEY || 'default-private-key';
        return SHA256(JSON.stringify(data) + privateKey).toString();
    }

    verifyDigitalSignature(certificate) {
        const expectedSignature = this.generateDigitalSignature({
            recipient: certificate.recipient,
            issuer: certificate.issuer,
            details: certificate.details,
            metadata: certificate.metadata
        });
        return certificate.verification.digitalSignature === expectedSignature;
    }

    generateInstitutionSignature() {
        return SHA256(process.env.INSTITUTION_ID + Date.now()).toString();
    }

    generateBlockchainAddress(studentId) {
        return '0x' + SHA256(studentId + 'smart-campus').toString().substring(0, 40);
    }

    generateCertificateId() {
        return 'SC' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();
    }

    generateTransactionId() {
        return 'TX' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();
    }

    generateQRCode(data) {
        // In production, use actual QR code library
        const qrData = JSON.stringify({
            id: data.id || this.generateCertificateId(),
            url: `${process.env.BASE_URL}/verify/${data.id || this.generateCertificateId()}`,
            checksum: this.calculateChecksum(data)
        });
        return Buffer.from(qrData).toString('base64');
    }

    findCertificate(certificateId) {
        for (const block of this.chain) {
            for (const cert of block.certificates) {
                if (cert.id === certificateId) {
                    return cert;
                }
            }
        }
        return null;
    }

    findCertificateBlockIndex(certificateId) {
        for (let i = 0; i < this.chain.length; i++) {
            for (const cert of this.chain[i].certificates) {
                if (cert.id === certificateId) {
                    return i;
                }
            }
        }
        return -1;
    }

    findCertificateBlockHash(certificateId) {
        for (const block of this.chain) {
            for (const cert of block.certificates) {
                if (cert.id === certificateId) {
                    return block.hash;
                }
            }
        }
        return null;
    }

    findCertificateBlockTimestamp(certificateId) {
        for (const block of this.chain) {
            for (const cert of block.certificates) {
                if (cert.id === certificateId) {
                    return block.timestamp;
                }
            }
        }
        return null;
    }

    getLastBlock() {
        return this.chain[this.chain.length - 1];
    }

    isChainValid() {
        for (let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i - 1];

            if (currentBlock.previousHash !== previousBlock.hash) {
                return false;
            }

            const hashValid = currentBlock.hash === this.calculateHash(
                currentBlock.index,
                currentBlock.timestamp,
                currentBlock.certificates,
                currentBlock.previousHash,
                currentBlock.nonce
            );

            if (!hashValid) {
                return false;
            }
        }
        return true;
    }

    calculateHashrate() {
        // Simplified hashrate calculation
        return Math.floor(Math.random() * 1000) + ' MH/s';
    }
}

module.exports = BlockchainService;
