<?php $this->load->view('templates/header'); ?>

<body>

  <div class="d-flex" id="wrapper">

    <!-- Sidebar -->
    <<?php $this->load->view('templates/navbar'); ?>
    <!-- /#sidebar-wrapper -->

    <!-- Page Content -->
    <div id="page-content-wrapper">
      <?php $this->load->view('templates/top_nav'); ?>

      <div class="container-fluid">
        <h3 class="mt-4">Edit DID</h3>
		<?php $attributes = array('class'=>'form-signin');
		echo form_open("dids/edit",$attributes);?>
			<div class="form-group">
				<label>DID <small><i>sip:0015188888395@194.67.195.120</i></small></label>
				<input class="form-control" id="did" name="did" placeholder="Enter DID Number" required value="<?php echo $fields->did;?>"/>
			</div>
			<div class="form-group">
				<label>Type</label>
				<select class="form-control" id="type" name="type" required />
					<option value="">Select Type</option>
					<option value="forwarding" <?php if($fields->type == 'forwarding'){echo "selected='selected'";}?>>Forwarding</option>
					<option value="switchboard" <?php if($fields->type == 'switchboard'){echo "selected='selected'";}?>>Switchboard</option>
				</select>
			</div>
			<div class="form-group" id="flListDiv"">
				<label>Forwarding List</label>
				<select class="form-control" id="fl_list" name="fl_list" onchange="setValue(this.value);" />
					<option value="">Select Forwarding List</option>
					<?php foreach($lists as $list) { ?>
					<option value="<?php echo $list->id;?>" <?php if($list->id == $fields->list_id){echo 'selected="selected"';}?>><?php echo $list->list_name;?></option>
					<?php } ?>
				</select>
			</div>
			<input id="destination" name="destination" type="hidden">
			<input type='hidden' id="id" name="id" value="<?php echo $fields->id; ?>" />
			<button type="submit" class="btn btn-success btn-sm">Save DID</button>
			<a href="<?php echo base_url();?>dids" class="btn btn-warning btn-sm">Cancel</a>
		<?php echo form_close();?>
      </div>
    </div>
    <!-- /#page-content-wrapper -->

  </div>
  <!-- /#wrapper -->
  <?php $this->load->view('templates/footer'); ?>
  
  <script>
	$(document).ready(function() {
		loadTypes('<?php echo $fields->type; ?>')
	});
	
	function loadTypes(type){
		//if(type == 'forwarding'){
			$('#flListDiv').show();
			$('#ivrListDiv').hide();
		//}
		//else{
			//$('#flListDiv').hide();
			//$('#ivrListDiv').show();
		//}
	}
	
	function setValue(id){
		$('#destination').val(id);
	}
  </script>

</body>

</html>
