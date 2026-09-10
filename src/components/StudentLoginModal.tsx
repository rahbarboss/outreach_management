/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Student } from '../types';
import {
  GraduationCap,
  X,
  Search,
  KeyRound,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Lock,
  MapPin,
} from 'lucide-react';

export const StudentLoginModal: React.FC = () => {
  const {
    showStudentLoginModal,
    setShowStudentLoginModal,
    students,
    loginAsStudent,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [enteredAdmissionNo, setEnteredAdmissionNo] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!showStudentLoginModal) return null;

  const activeStudents = students.filter((s) => s.isActive);
  const filteredStudents = activeStudents.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.course.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.admissionNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectStudent = (std: Student) => {
    setSelectedStudent(std);
    setEnteredAdmissionNo('');
    setErrorMsg('');
  };

  const handleBackToList = () => {
    setSelectedStudent(null);
    setEnteredAdmissionNo('');
    setErrorMsg('');
  };

  const handleSubmitLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    setErrorMsg('');
    setIsSubmitting(true);

    const cleanInput = enteredAdmissionNo.trim().toUpperCase();
    const cleanTarget = selectedStudent.admissionNumber.trim().toUpperCase();

    setTimeout(() => {
      setIsSubmitting(false);
      // Security Check: Must strictly match the selected student's admission number!
      if (cleanInput !== cleanTarget) {
        setErrorMsg(
          `Security verification failed: Admission number does not match ${selectedStudent.name}'s institutional record.`
        );
        return;
      }

      const success = loginAsStudent(cleanInput);
      if (success) {
        setShowStudentLoginModal(false);
        setSelectedStudent(null);
        setEnteredAdmissionNo('');
      } else {
        setErrorMsg('Authentication error. Account may be inactive.');
      }
    }, 250);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        id="student-login-modal"
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 p-6 text-white relative shrink-0">
          <button
            id="close-student-modal-btn"
            onClick={() => {
              setShowStudentLoginModal(false);
              setSelectedStudent(null);
            }}
            className="absolute top-4 right-4 text-blue-200 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold tracking-tight">Student Identity Portal</h3>
              <p className="text-xs text-blue-100">
                {selectedStudent
                  ? 'Verify your Admission Number to continue'
                  : 'Select your student profile to authenticate'}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {!selectedStudent ? (
            // Step 1: Student Selection Grid
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="student-search-input"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, course, or department..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm text-slate-800 placeholder-slate-400"
                  />
                </div>
                <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                  {filteredStudents.length} Students
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto p-1">
                {filteredStudents.map((std) => (
                  <div
                    key={std.id}
                    id={`student-card-${std.id}`}
                    onClick={() => handleSelectStudent(std)}
                    className="flex items-center gap-3.5 p-3.5 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 hover:shadow-xs transition-all cursor-pointer text-left group"
                  >
                    <img
                      src={std.avatarUrl}
                      alt={std.name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-slate-100 group-hover:border-blue-400 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-700">
                        {std.name}
                      </h4>
                      <p className="text-xs text-slate-600 truncate">{std.course}</p>
                      {std.address ? (
                        <p className="text-[11px] text-amber-700 font-medium flex items-center gap-1 mt-0.5 truncate">
                          <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                          <span>{std.address}</span>
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-400 truncate">{std.department}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {filteredStudents.length === 0 && (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-sm text-slate-500">No active students found matching "{searchQuery}".</p>
                </div>
              )}
            </div>
          ) : (
            // Step 2: Admission Number Verification
            <div className="max-w-md mx-auto space-y-5">
              <button
                type="button"
                onClick={handleBackToList}
                className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Select different student
              </button>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-4">
                <img
                  src={selectedStudent.avatarUrl}
                  alt={selectedStudent.name}
                  className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-xs"
                />
                <div>
                  <h4 className="text-base font-bold text-slate-900">{selectedStudent.name}</h4>
                  <p className="text-xs text-slate-600 font-medium">{selectedStudent.course}</p>
                  <p className="text-[11px] text-slate-500">{selectedStudent.department}</p>
                  {selectedStudent.address && (
                    <p className="text-xs text-amber-700 font-semibold flex items-center gap-1 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span>Address: {selectedStudent.address}</span>
                    </p>
                  )}
                </div>
              </div>

              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSubmitLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      Enter Your Admission Number
                    </span>
                    <span className="text-[11px] text-blue-600 font-normal">
                      Hint: {selectedStudent.admissionNumber}
                    </span>
                  </label>
                  <input
                    id="student-admission-input"
                    type="text"
                    required
                    autoFocus
                    value={enteredAdmissionNo}
                    onChange={(e) => setEnteredAdmissionNo(e.target.value)}
                    placeholder="e.g. ADM2026-001"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm font-mono uppercase text-slate-900 tracking-wider placeholder-slate-400"
                  />
                  <p className="text-[11px] text-slate-500">
                    To maintain privacy, each student account is secured with its unique institutional admission code.
                  </p>
                </div>

                <button
                  id="student-auth-submit-btn"
                  type="submit"
                  disabled={isSubmitting || !enteredAdmissionNo.trim()}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <KeyRound className="w-4 h-4" />
                  {isSubmitting ? 'Authenticating...' : 'Access My Student Portal'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
