const calcHeight = function (staffGroup: StaffGroupElement): number {
    // the height is calculated here in a parallel way to the drawing below in hopes that both of these functions will be modified together.
    // TODO-PER: also add the space between staves. (That's systemStaffSeparation, which is the minimum distance between the staff LINES.)
    let height: number = 0;
    for (let i: number = 0; i < staffGroup.voices.length; i++) {
        const staff: Staff = staffGroup.voices[i].staff;
        if (!staffGroup.voices[i].duplicate) {
            height += staff.top;
            //if (staff.bottom < 0)
            height += -staff.bottom;
        }
    }
    return height;
};
export default calcHeight;
