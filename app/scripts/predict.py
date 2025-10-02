import sys
import json
import pickle
import numpy as np
import os
import traceback
from scipy.special import inv_boxcox  # Import for inverse Box-Cox

def main():
    try:
        # Debug: Print raw input
        print(f"Raw input received: {sys.argv[1]}", file=sys.stderr)

        # Get current script directory
        scripts_dir = os.path.dirname(__file__)
        model_path = os.path.join(scripts_dir, 'linear_regression_model.pkl')

        # Debug: Verify model path exists
        if not os.path.exists(model_path):
            print(f"Model file not found at: {model_path}", file=sys.stderr)
            return 1

        # Load model
        try:
            model = pickle.load(open(model_path, 'rb'))
            print("Model loaded successfully", file=sys.stderr)
        except Exception as e:
            print(f"Model loading failed: {str(e)}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            return 1

        # Read and validate input data
        try:
            input_data = json.loads(sys.argv[1])
            print("JSON parsed successfully", file=sys.stderr)
        except json.JSONDecodeError as e:
            print(f"Invalid JSON: {str(e)}", file=sys.stderr)
            return 1

        print(f"Received data: {input_data}", file=sys.stderr)

        # Encoders
        event_type_encoder = {'Wedding': 5, 'Corporate Event': 2, 'Engagement Party': 3, 'Anniversary': 0}
        product_name_encoder = {'Versailles Chair': 13, 'Surpentine Buffet Table': 12, 'Red Carpet': 11,'Navy Blue and Yellow Tent': 6}
        season_period_encoder = {'1-4': 0, '5-8': 1, '9-12': 2}

        # Encode categorical features
        try:
            event_type_encoded = event_type_encoder[input_data['event_type']]
            product_name_encoded = product_name_encoder[input_data['product_name']]
            season_period_encoded = season_period_encoder[input_data['season_period']]
        except KeyError as e:
            print(f"Unknown category: {str(e)}", file=sys.stderr)
            return 1

        # Prepare features
        try:
            features = [
                event_type_encoded,
                product_name_encoded,
                float(input_data['quantity']),
                float(input_data['unit_price']),
                float(input_data['duration_days']),
                season_period_encoded,
                float(input_data['month']),
                float(input_data['year'])
            ]
            print(f"Features prepared: {features}", file=sys.stderr)
        except (ValueError, KeyError) as e:
            print(f"Feature preparation error: {str(e)}", file=sys.stderr)
            return 1

        # Prediction
        try:
            features_array = np.array([features], dtype=np.float32)
            transformed_prediction = model.predict(features_array)[0]
            
            # Inverse Box-Cox
            fitted_lambda = 0.1560355836754312  # Replace with your actual lambda
            actual_prediction = inv_boxcox(transformed_prediction, fitted_lambda)
            
            # Output result
            print(actual_prediction)  # Node.js will receive this via stdout
            return 0
        except Exception as e:
            print(f"Prediction failed: {str(e)}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            return 1

    except Exception as e:
        print(f"Unexpected error: {str(e)}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())
