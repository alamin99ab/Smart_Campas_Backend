const Subscription = require('../models/Subscription');

const NAMESPACE_NOT_FOUND = 26;
const INDEX_NOT_FOUND = 27;
const LEGACY_SUBSCRIPTION_INVOICE_INDEX = 'invoices.invoiceNumber_1';

const loadIndexes = async () => {
    try {
        return await Subscription.collection.indexes();
    } catch (error) {
        if (error?.code === NAMESPACE_NOT_FOUND) {
            return [];
        }

        throw error;
    }
};

const ensureMongoIndexes = async () => {
    const indexes = await loadIndexes();
    const legacyInvoiceIndex = indexes.find((index) => index.name === LEGACY_SUBSCRIPTION_INVOICE_INDEX);

    if (legacyInvoiceIndex) {
        try {
            await Subscription.collection.dropIndex(LEGACY_SUBSCRIPTION_INVOICE_INDEX);
            console.log('Removed legacy Subscription invoice index that blocked multi-school provisioning');
        } catch (error) {
            if (error?.code !== INDEX_NOT_FOUND) {
                throw error;
            }
        }
    }

    await Subscription.createIndexes();
};

module.exports = { ensureMongoIndexes };
