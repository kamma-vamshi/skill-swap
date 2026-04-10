import { useState } from "react";
import axios from "axios";

const ReviewForm = ({ userId, swapId }) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const submitReview = async () => {
    await axios.post("/api/reviews", {
      reviewedUser: userId,
      swapId,
      rating,
      comment,
    });

    alert("Review submitted!");
  };

  return (
    <div className="p-4 border rounded">
      <h3>Give Review</h3>

      <select value={rating} onChange={(e) => setRating(e.target.value)}>
        {[1,2,3,4,5].map(n => (
          <option key={n} value={n}>{n} ⭐</option>
        ))}
      </select>

      <textarea
        placeholder="Write feedback..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />

      <button onClick={submitReview}>Submit</button>
    </div>
  );
};

export default ReviewForm;
