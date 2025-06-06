'use client'

export default function Step2() {
	return (
		<div className="space-y-4">
			<label className="form-control w-full">
				<span className="label-text text-sm">Club Code</span>
				<input
					type="text"
					placeholder="e.g. CLUB1234"
					className="input input-bordered w-full"
				/>
			</label>
		</div>
	)
}
