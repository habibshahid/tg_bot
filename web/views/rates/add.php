<?php $this->load->view('templates/header'); ?>

<body>

  <div class="d-flex" id="wrapper">

    <!-- Sidebar -->
    <?php $this->load->view('templates/navbar'); ?>
    <!-- /#sidebar-wrapper -->

    <!-- Page Content -->
    <div id="page-content-wrapper">
	  <?php $this->load->view('templates/top_nav'); ?>
      

      <div class="container-fluid">
        <h3 class="mt-4">Add Rate</h3>
		<nav aria-label="breadcrumb">
			<ol class="breadcrumb">
				<li class="breadcrumb-item"><a href="<?php echo base_url(); ?>rates">Rates</a></li>
				<li class="breadcrumb-item active">Add Rate</li>
			</ol>
		</nav>
		<h6 class="mt-4"><?php echo $this->session->flashdata('message');?></h6>
		
		<?php $attributes = array('class'=>'form-signin');
		echo form_open("rates/add",$attributes);?>
		
			<!-- Rate Card Selection -->
			<div class="card mb-4">
				<div class="card-header">
					<h5>Rate Card Selection</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="form-group col-md-6">
							<label>Rate Card <span class="text-danger">*</span></label>
							<select class="form-control" id="rate_card_id" name="rate_card_id" required onchange="showRateCardInfo(this.value)">
								<option value="">Select Rate Card</option>
								<?php foreach($rate_cards as $rate_card): ?>
								<option value="<?php echo $rate_card->id; ?>" 
									data-currency="<?php echo $rate_card->currency; ?>"
									data-provider="<?php echo $rate_card->provider_name; ?>"
									<?php echo set_select('rate_card_id', $rate_card->id); ?>>
									<?php echo $rate_card->name . ' (' . $rate_card->currency . ')' . ' - ' . $rate_card->provider_name; ?>
								</option>
								<?php endforeach; ?>
							</select>
						</div>
						<div class="col-md-6" id="rate_card_info" style="display: none;">
							<div class="alert alert-info">
								<strong>Selected Rate Card:</strong> <span id="selected_rate_card_name"></span><br>
								<strong>Currency:</strong> <span id="selected_currency"></span><br>
								<strong>Provider:</strong> <span id="selected_provider"></span>
							</div>
						</div>
					</div>
				</div>
			</div>
			
			<!-- Destination Selection -->
			<div class="card mb-4">
				<div class="card-header">
					<h5>Destination Selection</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="form-group col-md-6">
							<label>Destination <span class="text-danger">*</span></label>
							<select class="form-control" id="destination_id" name="destination_id" required onchange="showDestinationInfo(this.value)">
								<option value="">Select Destination</option>
								<?php foreach($destinations as $destination): ?>
								<option value="<?php echo $destination->id; ?>"
									data-code="<?php echo $destination->prefix; ?>"
									data-country="<?php echo $destination->country_name; ?>"
									data-region="<?php echo $destination->region; ?>"
									<?php echo set_select('destination_id', $destination->id); ?>>
									<?php echo $destination->prefix . ' - ' . $destination->country_name . ($destination->description ? ' (' . $destination->description . ')' : ''); ?>
								</option>
								<?php endforeach; ?>
							</select>
						</div>
						<div class="col-md-6" id="destination_info" style="display: none;">
							<div class="alert alert-info">
								<strong>Destination Code:</strong> <span id="selected_dest_code"></span><br>
								<strong>Country:</strong> <span id="selected_country"></span><br>
							</div>
						</div>
					</div>
					<div class="row">
						<div class="col-md-12">
							<small class="text-muted">
								<strong>Tip:</strong> You can search destinations by typing the country name, destination code, or destination name.
							</small>
						</div>
					</div>
				</div>
			</div>
			
			<!-- Rate Configuration -->
			<div class="card mb-4">
				<div class="card-header">
					<h5>Rate Configuration</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="form-group col-md-6">
							<label>Cost per Minute <span class="text-danger">*</span></label>
							<div class="input-group">
								<div class="input-group-prepend">
									<span class="input-group-text" id="currency_symbol">$</span>
								</div>
								<input class="form-control" id="cost_price" name="cost_price" type="number" step="0.0001" placeholder="0.0000" value="<?php echo set_value('cost_price'); ?>" required />
							</div>
							<small class="form-text text-muted">Enter the cost per minute for calls to this destination</small>
						</div>
						<div class="form-group col-md-6">
							<label>Price per Minute <span class="text-danger">*</span></label>
							<div class="input-group">
								<div class="input-group-prepend">
									<span class="input-group-text" id="currency_symbol">$</span>
								</div>
								<input class="form-control" id="sell_price" name="sell_price" type="number" step="0.0001" placeholder="0.0000" value="<?php echo set_value('sell_price'); ?>" required />
							</div>
							<small class="form-text text-muted">Enter the selling per minute for calls to this destination</small>
						</div>
					</div>
				</div>
			</div>
			
			<!-- Billing Configuration -->
			<div class="card mb-4">
				<div class="card-header">
					<h5>Billing Configuration</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="form-group col-md-6">
							<label>Billing Increment (seconds) <span class="text-danger">*</span></label>
							<select class="form-control" id="billing_increment" name="billing_increment" required>
								<option value="1" <?php echo set_select('billing_increment', '1'); ?>>1 second</option>
								<option value="6" <?php echo set_select('billing_increment', '6'); ?>>6 seconds</option>
								<option value="30" <?php echo set_select('billing_increment', '30'); ?>>30 seconds</option>
								<option value="60" <?php echo set_select('billing_increment', '60', TRUE); ?>>60 seconds (1 minute)</option>
							</select>
							<small class="form-text text-muted">Calls will be billed in these increments</small>
						</div>
						<div class="form-group col-md-6">
							<label>Minimum Duration (seconds) <span class="text-danger">*</span></label>
							<select class="form-control" id="minimum_duration" name="minimum_duration" required>
								<option value="0" <?php echo set_select('minimum_duration', '0'); ?>>No minimum</option>
								<option value="30" <?php echo set_select('minimum_duration', '30'); ?>>30 seconds</option>
								<option value="60" <?php echo set_select('minimum_duration', '60', TRUE); ?>>60 seconds (1 minute)</option>
								<option value="120" <?php echo set_select('minimum_duration', '120'); ?>>120 seconds (2 minutes)</option>
							</select>
							<small class="form-text text-muted">Minimum billable duration for each call</small>
						</div>
					</div>
				</div>
			</div>
			
			<!-- Effective Dates -->
			<div class="card mb-4">
				<div class="card-header">
					<h5>Effective Dates</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="form-group col-md-6">
							<label>Effective Date <span class="text-danger">*</span></label>
							<input class="form-control" id="effective_from" name="effective_from" type="date" value="<?php echo set_value('effective_from', date('Y-m-d')); ?>" required />
							<small class="form-text text-muted">Date when this rate becomes active</small>
						</div>
						<div class="form-group col-md-6">
							<label>Expiry Date</label>
							<input class="form-control" id="effective_to" name="effective_to" type="date" value="<?php echo set_value('effective_to'); ?>" />
							<small class="form-text text-muted">Optional: Date when this rate expires</small>
						</div>
					</div>
				</div>
			</div>
			
			<!-- Rate Preview -->
			<div class="card mb-4" id="rate_preview" style="display: none;">
				<div class="card-header bg-info text-white">
					<h5>Rate Preview</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="col-md-12">
							<table class="table table-borderless">
								<tr>
									<td><strong>Destination:</strong></td>
									<td id="preview_destination">-</td>
								</tr>
								<tr>
									<td><strong>Cost per Minute:</strong></td>
									<td id="preview_rate">-</td>
								</tr>
								<tr>
									<td><strong>Sell Fee:</strong></td>
									<td id="preview_connect_fee">-</td>
								</tr>
								<tr>
									<td><strong>Billing:</strong></td>
									<td id="preview_billing">-</td>
								</tr>
								<tr>
									<td><strong>Example Cost (5 min call):</strong></td>
									<td id="preview_example_cost" class="text-success font-weight-bold">-</td>
								</tr>
							</table>
						</div>
					</div>
				</div>
			</div>
			
			<hr>
			<button type="submit" class="btn btn-success btn-sm">Add Rate</button>
			<a href="<?php echo base_url();?>rates" class="btn btn-warning btn-sm">Cancel</a>
			<br><br><br><br>
		<?php echo form_close();?>
      </div>
    </div>
    <!-- /#page-content-wrapper -->

  </div>
  <!-- /#wrapper -->

  <?php $this->load->view('templates/footer'); ?>
  
  <script>
	$(document).ready(function(){
		// Make destination select searchable
		if(typeof $.fn.select2 !== 'undefined'){
			$('#destination_id').select2({
				placeholder: "Search destinations...",
				allowClear: true
			});
		}
		
		// Update preview when values change
		$('#rate, #connect_fee, #increment, #minimum_duration').on('input change', updatePreview);
		$('#destination_id, #rate_card_id').on('change', updatePreview);
	});
	
	function showRateCardInfo(rateCardId){
		if(!rateCardId){
			$('#rate_card_info').hide();
			return;
		}
		
		var option = $('#rate_card_id option[value="' + rateCardId + '"]');
		if(option.length){
			$('#selected_rate_card_name').text(option.text().split(' (')[0]);
			$('#selected_currency').text(option.data('currency'));
			$('#selected_provider').text(option.data('provider') || 'N/A');
			$('#rate_card_info').show();
			
			// Update currency symbols
			var currency = option.data('currency');
			var symbol = getCurrencySymbol(currency);
			$('#currency_symbol').text(symbol);
			$('#currency_symbol2').text(symbol);
		}
		updatePreview();
	}
	
	function showDestinationInfo(destinationId){
		if(!destinationId){
			$('#destination_info').hide();
			return;
		}
		
		var option = $('#destination_id option[value="' + destinationId + '"]');
		if(option.length){
			$('#selected_dest_code').text(option.data('code'));
			$('#selected_country').text(option.data('country') || 'N/A');
			$('#selected_region').text(option.data('region') || 'N/A');
			$('#destination_info').show();
		}
		updatePreview();
	}
	
	function updatePreview(){
		var rateCardId = $('#rate_card_id').val();
		var destinationId = $('#destination_id').val();
		var rate = parseFloat($('#cost_price').val()) || 0;
		var connectFee = parseFloat($('#sell_price').val()) || 0;
		var increment = parseInt($('#billing_increment').val()) || 60;
		var minDuration = parseInt($('#minimum_duration').val()) || 60;
		
		if(!rateCardId || !destinationId || rate <= 0){
			$('#rate_preview').hide();
			return;
		}
		
		var rateCardOption = $('#rate_card_id option[value="' + rateCardId + '"]');
		var destOption = $('#destination_id option[value="' + destinationId + '"]');
		var currency = rateCardOption.data('currency') || 'USD';
		var symbol = getCurrencySymbol(currency);
		
		// Update preview
		$('#preview_destination').text(destOption.text());
		$('#preview_rate').text(symbol + rate.toFixed(4) + ' per minute');
		$('#preview_connect_fee').text(connectFee > 0 ? symbol + connectFee.toFixed(4) : 'Free');
		$('#preview_billing').text(increment + 's increments, ' + minDuration + 's minimum');
		
		// Calculate example cost for 5-minute call
		var callDuration = 300; // 5 minutes = 300 seconds
		var billableDuration = Math.max(callDuration, minDuration);
		var billingUnits = Math.ceil(billableDuration / increment);
		var actualBillableDuration = billingUnits * increment;
		var cost = connectFee + (rate * actualBillableDuration / 60);
		
		$('#preview_example_cost').text(symbol + cost.toFixed(4));
		$('#rate_preview').show();
	}
	
	function getCurrencySymbol(currency){
		var symbols = {
			'USD': '$',
			'EUR': '€',
			'GBP': '£',
			'PKR': '₨',
			'AED': 'د.إ'
		};
		return symbols[currency] || '$';
	}
  </script>

</body>

</html>