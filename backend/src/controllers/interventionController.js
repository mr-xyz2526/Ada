const dataService = require('../services/dataService');

const interventionController = {
  addIntervention: async (req, res) => {
    const { studentId, note } = req.body;
    if (!studentId || !note) return res.status(400).json({ message: 'studentId and note are required.' });

    const student = await dataService.getStudentById(studentId, {
      role: req.user.role,
      mentorId: req.user.id,
    });

    if (!student) return res.status(404).json({ message: 'Student not found or unauthorized.' });

    const intervention = await dataService.createIntervention({
      studentId,
      mentorId: req.user.role === 'mentor' ? req.user.id : null,
      note,
      role: req.user.role,
    });

    return res.status(201).json(intervention);
  },
};

module.exports = interventionController;
