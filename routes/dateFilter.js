const moment = require('moment');

// Endpoint to get events by category and within a week starting from April 2024 Sunday to Saturday
app.get('/events/this-week/:dateRange', async (req, res) => {
    const dateRange = req.params.dateRange.split(' - '); // Split date range into start and end dates
    const startDate = new Date(dateRange[0]);
    const endDate = new Date(dateRange[1]);

    try {
        const filteredEvents = await EventModel.find({
            $or: [
                { startDate: { $lte: endDate }, endDate: { $gte: startDate } }, // Check if any part of event range overlaps with specified date range
                { $and: [{ startDate: { $gte: startDate } }, { startDate: { $lte: endDate } }] }, // Check if event starts within specified date range
                { $and: [{ endDate: { $gte: startDate } }, { endDate: { $lte: endDate } }] } // Check if event ends within specified date range
            ]
        });

        res.json(filteredEvents);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Internal Server Error');
    }
});