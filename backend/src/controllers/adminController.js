const dataService = require('../services/dataService');

const adminController = {
  getMentors: async (_req, res) => {
    const mentors = await dataService.getMentors();
    return res.json(mentors);
  },

  assignMentor: async (req, res) => {
    const { studentId, mentorId } = req.body;
    if (!studentId || !mentorId) return res.status(400).json({ message: 'studentId and mentorId are required.' });

    const updated = await dataService.assignMentor({ studentId, mentorId });
    if (!updated) return res.status(404).json({ message: 'Student not found.' });

    return res.json({ message: 'Mentor assigned successfully.', student: updated });
  },
};

module.exports = adminController;
